#!/bin/bash
set -uo pipefail

BACKUP_DIR="/opt/santos-saf/backups/config"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$DEST"
cp /opt/santos-saf/.env "$DEST/env.backup"
cp /opt/santos-saf/docker-compose.yml "$DEST/docker-compose.yml"
cp /opt/santos-saf/Caddyfile "$DEST/Caddyfile.vps-live"
git -C /opt/santos-saf rev-parse HEAD > "$DEST/git-commit.txt"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} \;

echo "Config backup OK: $TIMESTAMP"
