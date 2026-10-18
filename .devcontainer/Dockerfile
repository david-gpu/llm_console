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
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    python3 \
    python3-numpy \
    python3-matplotlib

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
