#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
DEST=${DEST:-/var/backups/proxhqvpn/postgres}
mkdir -p "$DEST"
FILE="$DEST/proxhqvpn-$(date -u +%Y%m%d%H%M%S).dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"
sha256sum "$FILE" > "$FILE.sha256"
echo "Backup written: $FILE"
