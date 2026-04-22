#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/coined"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <release-sha>"
  exit 1
fi

RELEASE_SHA="$1"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_SHA"
ARCHIVE_PATH="$RELEASE_DIR/release.tar.gz"

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Release archive not found: $ARCHIVE_PATH"
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/logs"

tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"
rm -f "$ARCHIVE_PATH"

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "Missing shared env file at $SHARED_DIR/.env"
  exit 1
fi

ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
rm -rf "$RELEASE_DIR/uploads"
ln -sfn "$SHARED_DIR/uploads" "$RELEASE_DIR/uploads"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

cd "$CURRENT_LINK"
npm ci --omit=dev

if pm2 describe coined-backend >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
fi

pm2 save

find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Deployment completed for release $RELEASE_SHA"
