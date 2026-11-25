#!/usr/bin/env bash
# Restaura un respaldo creado con respaldo.sh: ./scripts/restaurar.sh respaldos/archivo.dump
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
ARCHIVO="${1:?Indique el archivo .dump}"
PGPASSWORD="$DB_PASSWORD" PGSSLMODE="$([ -n "${DB_SSL:-}" ] && echo require || echo prefer)" pg_restore -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner "$ARCHIVO"
echo "Base $DB_NAME restaurada desde $ARCHIVO"
