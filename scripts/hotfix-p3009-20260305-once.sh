#!/bin/sh
# Hotfix idempotente para destrabar Prisma P3009.
# Diseñado para ejecutarse una sola vez, pero es seguro re-ejecutarlo.

set -u

HOTFIX_MIGRATION_NAME="${HOTFIX_MIGRATION_NAME:-20260305_update_launch_trial_duration_20_days}"

echo "🔧 Ejecutando hotfix P3009 para migración: ${HOTFIX_MIGRATION_NAME}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "⚠️ DATABASE_URL no está definida. No se puede resolver migración, continuando sin cambios."
  exit 0
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "⚠️ npx no está disponible en el contenedor. Continuando sin cambios."
  exit 0
fi

OUTPUT_FILE="$(mktemp)"

if npx prisma migrate resolve --rolled-back "${HOTFIX_MIGRATION_NAME}" >"${OUTPUT_FILE}" 2>&1; then
  echo "✅ Hotfix aplicado: migración marcada como rolled back."
  cat "${OUTPUT_FILE}"
  rm -f "${OUTPUT_FILE}"
  exit 0
fi

HOTFIX_OUTPUT="$(cat "${OUTPUT_FILE}")"
rm -f "${OUTPUT_FILE}"

echo "${HOTFIX_OUTPUT}"

if echo "${HOTFIX_OUTPUT}" | grep -qiE "not in a failed state|already applied|already recorded|cannot be rolled back"; then
  echo "ℹ️ Hotfix ya estaba aplicado o no era necesario."
  exit 0
fi

echo "⚠️ No se pudo resolver automáticamente el estado de la migración."
echo "⚠️ Continuando para no bloquear el deploy; revisar logs de Prisma."
exit 0
