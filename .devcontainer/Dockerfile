FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Note: the base image already ships a "vscode" user with passwordless sudo.
# Undo that damage: remove sudo and its group entirely.
RUN rm -f /etc/sudoers.d/* \
    && apt-get remove -y sudo || true \
    && rm -rf /var/lib/sudo 2>/dev/null || true

# Install your toolchain here, as root, BEFORE the USER switch:
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    python3 \
    python3-numpy \
    python3-matplotlib \
    nodejs \
    npm \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Headless browser for rendering the app during development.
#
# Ubuntu 24.04's "chromium" package does not exist and "chromium-browser" is a
# snap stub, so we use Playwright's own bundled Chromium instead. It is pinned
# so screenshots are reproducible across rebuilds.
#
# PLAYWRIGHT_BROWSERS_PATH is a shared location (not under ~/.cache) so the
# browser is available to any session/user in this container. `--with-deps`
# installs Chromium's system libraries; it must run as root.
#
# NOTE ON SANDBOXING: this container runs with --cap-drop=ALL and
# no-new-privileges, so Chromium's own sandbox cannot start. The render helper
# launches with --no-sandbox, which is acceptable here because it only ever
# loads the local, trusted app file -- never arbitrary web content.
#
# `--with-deps` also pulls fonts-liberation / fonts-freefont-ttf. That matters
# here: without any fonts installed, Chromium silently substitutes a default
# face and the McModern sans-serif interface would render like a monospace.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN npm install -g playwright@1.64.1 \
    && playwright install --with-deps chromium \
    && chmod -R a+rX /opt/playwright

# Ensure home and common dirs are owned by the non-root user
RUN mkdir -p /home/${USERNAME}/.vscode-server \
    && chown -R ${USER_UID}:${USER_GID} /home/${USERNAME}

# Ensure home and common dirs are owned by the non-root user
# (also pre-create the extension cache dir so VSCode's first-run
#  extension seeding doesn't fail on a missing directory)
RUN mkdir -p /home/${USERNAME}/.vscode-server/extensionsCache \
    && mkdir -p /home/${USERNAME}/.vscode-server/extensions \
    && chown -R ${USER_UID}:${USER_GID} /home/${USERNAME}

# Switch user
USER $USERNAME
WORKDIR /home/vscode
