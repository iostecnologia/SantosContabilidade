#!/bin/bash
set -uo pipefail

BACKUP_DIR="/opt/santos-saf/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="santos_saf_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec santos_saf_postgres pg_dump -U postgres santos_saf | gzip > "$BACKUP_DIR/$FILENAME"
DUMP_STATUS=${PIPESTATUS[0]}

if [ "$DUMP_STATUS" -ne 0 ] || ! gzip -t "$BACKUP_DIR/$FILENAME" 2>/dev/null; then
    echo "ERRO: backup $FILENAME falhou (pg_dump exit $DUMP_STATUS) ou corrompido" >&2
    rm -f "$BACKUP_DIR/$FILENAME"
    exit 1
fi

find "$BACKUP_DIR" -name 'santos_saf_db_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup OK: $FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
