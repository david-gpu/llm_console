FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

# Remove passwordless sudo for the vscode user.
# Done in a single layer, with apt lists refreshed first so the removal cannot
# silently depend on the base image's cached state. No "|| true": if sudo
# cannot be removed we want the build to fail loudly rather than ship an image
# where the user still has root escalation.
# Note: apt-get remove drops the package but NOT the "sudo" group, so the user
# is removed from it explicitly before the group is deleted.
RUN apt-get update \
    && gpasswd -d ${USERNAME} sudo 2>/dev/null || true; \
    rm -f /etc/sudoers.d/* \
    && apt-get remove -y --purge sudo \
    && groupdel sudo 2>/dev/null || true \
    && rm -rf /var/lib/sudo \
    && rm -rf /var/lib/apt/lists/*

# Toolchain and headless-browser system dependencies, installed as root.
# Node comes from NodeSource because Ubuntu 24.04 ships Node 18, which is too
# old for Playwright 1.64.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        python3 \
        python3-numpy \
        python3-matplotlib \
        ca-certificates \
        curl \
        gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Playwright's bundled Chromium, pinned for reproducible screenshots.
# PLAYWRIGHT_BROWSERS_PATH lives outside ~/.cache so any session in the
# container can use it; --with-deps pulls Chromium's shared libraries and
# fonts-liberation / fonts-freefont-ttf, without which the McModern sans-serif
# UI renders with a substituted face.
#
# The container runs with --cap-drop=ALL and no-new-privileges, so Chromium's
# sandbox cannot initialise; the render helper passes --no-sandbox, which is
# acceptable because it only ever loads the local, trusted app file.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN npm install -g playwright@1.64.1 \
    && playwright install --with-deps chromium \
    && chmod -R a+rX /opt/playwright \
    && npm cache clean --force

# Pre-create the VS Code server and extension directories so the first-run
# extension seeding does not race a missing directory, and hand the whole home
# directory to the non-root user in the same layer.
RUN mkdir -p /home/${USERNAME}/.vscode-server/extensions \
             /home/${USERNAME}/.vscode-server/extensionsCache \
    && chown -R ${USER_UID}:${USER_GID} /home/${USERNAME}

USER ${USERNAME}
WORKDIR /home/${USERNAME}

