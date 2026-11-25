#!/usr/bin/env bash
# Respaldo completo de la base con pg_dump; usa las variables DB_* del entorno o del .env
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
DESTINO="${1:-respaldos}"
mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/${DB_NAME}_$(date +%Y%m%d_%H%M%S).dump"
PGPASSWORD="$DB_PASSWORD" PGSSLMODE="$([ -n "${DB_SSL:-}" ] && echo require || echo prefer)" pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner -f "$ARCHIVO" || { rm -f "$ARCHIVO"; exit 1; }
echo "Respaldo creado: $ARCHIVO"
# Conserva solo los 30 respaldos más recientes
ls -1t "$DESTINO"/*.dump | tail -n +31 | xargs -r rm --
