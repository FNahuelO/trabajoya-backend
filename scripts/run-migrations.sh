#!/bin/sh
set -e

SEPARATOR="=================================================="

echo "$SEPARATOR"
echo "📦 Ejecutando migraciones de Prisma"
echo "$SEPARATOR"
echo "📅 Fecha: $(date -Iseconds 2>/dev/null || date)"
echo "🌍 Entorno: ${NODE_ENV:-development}"
echo ""

# Verificar estado antes
echo "🔍 Verificando estado de migraciones antes de aplicar..."
if command -v npx >/dev/null 2>&1; then
  npx prisma migrate status || echo "⚠️  No se pudo verificar el estado"
fi

echo ""
echo "🚀 Aplicando migraciones..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy
elif command -v npx >/dev/null 2>&1; then
  npx prisma migrate deploy
else
  echo "❌ Error: Prisma no encontrado"
  exit 1
fi

echo ""
echo "✅ Migraciones aplicadas exitosamente"
echo "$SEPARATOR"

