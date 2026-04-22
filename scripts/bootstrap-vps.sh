#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/coined"
SHARED_DIR="$APP_ROOT/shared"

sudo mkdir -p "$APP_ROOT/releases" "$SHARED_DIR/uploads" "$SHARED_DIR/logs"
sudo chown -R "$USER":"$USER" "$APP_ROOT"

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

pm2 startup systemd -u "$USER" --hp "$HOME"

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  cp .env.example "$SHARED_DIR/.env"
  echo "Created $SHARED_DIR/.env from .env.example. Edit it before first deploy."
fi

echo "VPS bootstrap complete."
