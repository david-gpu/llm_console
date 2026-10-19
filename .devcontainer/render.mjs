#!/usr/bin/env node
/*
 * Render index.html headlessly and capture screenshots per interface.
 *
 * Usage:
 *   node .devcontainer/render.mjs [--out DIR] [--url URL] [--interface all|retrogrouch|mcmodern]
 *
 * Defaults: --out /tmp/kilo/shots, --url file://<repo>/index.html,
 *           --interface all.
 *
 * Each interface is rendered twice: desktop (1280x900) and mobile (375x812).
 * The config is seeded into localStorage BEFORE the page scripts run, so the
 * <head> interface bootstrap is exercised exactly as a real returning user
 * would see it. A dummy API key/host is supplied so the app skips the
 * first-run settings screen; no network requests are made while idle.
 *
 * Runs Chromium with --no-sandbox: the container drops all capabilities and
 * sets no-new-privileges, so the browser sandbox cannot start. Only the
 * local, trusted app file is ever loaded.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

/* `playwright` is installed GLOBALLY in the image, and Node's import() does not
 * search the global node_modules directory. Try, in order:
 *   1. the local install (if someone ran `npm i playwright` in the repo),
 *   2. `<npm root -g>/playwright` (the Dockerfile's global install).
 * This keeps `node .devcontainer/render.mjs` working with no local deps. */
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch { /* fall through to the global install */ }

  let root = '';
  try { root = execSync('npm root -g', { encoding: 'utf8' }).trim(); } catch { /* no npm */ }
  const candidate = root && join(root, 'playwright', 'index.mjs');
  if (candidate && existsSync(candidate)) return import(pathToFileURL(candidate).href);

  throw new Error(
    'Cannot find Playwright. Rebuild the devcontainer image (it installs ' +
    'playwright globally), or run `npm i playwright` in the repo.'
  );
}

const { chromium } = await loadPlaywright();

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const out = arg('out', '/tmp/kilo/shots');
const url = arg('url', `file://${resolve(repo, 'index.html')}`);
const which = arg('interface', 'all');
const interfaces = which === 'all' ? ['retrogrouch', 'mcmodern'] : [which];

const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 375, height: 812 },
};

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const results = [];

for (const iface of interfaces) {
  for (const [label, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      hasTouch: label === 'mobile',
      isMobile: label === 'mobile',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    // Seed config before any page script runs (mirrors a returning user).
    // Guarded so the script is idempotent across navigations: addInitScript
    // re-runs on every load, and without this guard a reload would silently
    // reset the interface back to the value baked into this script.
    await page.addInitScript((style) => {
      try { if (localStorage.getItem('llm-console-config')) return; } catch { return; }
      const config = {
        interfaceStyle: style,
        apiKey: 'render-placeholder',
        apiHost: 'https://api.deepinfra.com',
        apiPath: 'v1/openai/chat/completions',
        tavilyApiKey: '',
        maxTavilyCalls: 8,
        serviceTier: '',
        model: 'deepseek-ai/DeepSeek-V4.1-Flash',
        visionModel: 'deepseek-ai/DeepSeek-V4.1-Flash',
        imageModel: 'black-forest-labs/FLUX-2-klein-9b',
        reasoningEffort: 'medium',
        imageResolution: '1280x720',
        imageQuality: 'standard',
        imageStyle: 'natural',
        ttsVoice: 'Aiden',
        ttsInstruct: 'Friendly and relaxed',
        systemPrompt: 'You are a helpful assistant.',
        extraParams: {},
      };
      try { localStorage.setItem('llm-console-config', JSON.stringify(config)); }
      catch { /* storage unavailable: the app will show its first-run screen */ }
    }, iface);

    await page.goto(url, { waitUntil: 'load' });
    // Let the CRT warm-up animation finish (4s) so Retrogrouch shots are stable.
    await page.waitForTimeout(4200);
    await page.evaluate(() => document.fonts?.ready);

    const shot = resolve(out, `${iface}-${label}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const info = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = (n) => cs.getPropertyValue(n).trim();
      return {
        dataInterface: document.documentElement.dataset.interface || '(unset)',
        bg: get('--bg'),
        userFg: get('--user-fg'),
        systemFg: get('--system-fg'),
        fontUi: get('--font-ui').slice(0, 60),
        fontCode: get('--font-code').slice(0, 60),
        overlayDisplay: getComputedStyle(document.querySelector('.crt-overlay')).display,
        contentAnimation: getComputedStyle(document.querySelector('.crt-screen-content')).animationName,
        splashShown: [...document.querySelectorAll('.splash-art')]
          .filter((el) => getComputedStyle(el).display !== 'none')
          .map((el) => el.className.replace('splash-art ', '')),
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      };
    });

    results.push({ iface, label, shot, errors, info });
    await context.close();
  }
}

await browser.close();

for (const r of results) {
  console.log(`\n[${r.iface}/${r.label}] ${r.shot}`);
  for (const [k, v] of Object.entries(r.info)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  if (r.errors.length) {
    console.log('  CONSOLE ERRORS:');
    for (const e of r.errors) console.log('   -', e);
  }
}
