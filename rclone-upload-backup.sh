#!/bin/bash
set -uo pipefail

REMOTE="gdrive"
LOCAL_DIR="/opt/santos-saf/backups"
REMOTE_DIR="SantosSAF-Backups"

if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:$"; then
    echo "AVISO: remote rclone '${REMOTE}:' ainda nao configurado (rode 'rclone config'). Pulando upload." >&2
    exit 0
fi

rclone copy "$LOCAL_DIR" "${REMOTE}:${REMOTE_DIR}" --min-age 1m
echo "Upload para ${REMOTE}:${REMOTE_DIR} concluido: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
