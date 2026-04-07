#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DB_PATH=${DATABASE_FILE:-"$ROOT_DIR/data/majordomo.db"}
BACKUP_DIR=${BACKUP_DIR:-"$ROOT_DIR/backups"}

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database file not found at $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_PATH="$BACKUP_DIR/majordomo-$TIMESTAMP.db"

python3 - "$DB_PATH" "$BACKUP_PATH" <<'PY'
import sqlite3
import sys

source_path, backup_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect(source_path)
backup = sqlite3.connect(backup_path)
try:
    source.backup(backup)
finally:
    backup.close()
    source.close()
PY

chmod 600 "$BACKUP_PATH"
echo "Created backup: $BACKUP_PATH"
