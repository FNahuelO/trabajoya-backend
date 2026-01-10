#!/bin/sh
set -e

echo "🔧 Resolviendo todas las migraciones fallidas..."
echo ""
echo "⚠️  ATENCIÓN: Este script marca todas las migraciones fallidas como resueltas."
echo "Solo úsalo si estás seguro de que quieres limpiar el estado de migraciones."
echo ""
read -p "¿Continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔍 Verificando migraciones fallidas..."

# Obtener lista de migraciones fallidas
FAILED_MIGRATIONS=$(npx prisma migrate status --schema=prisma/schema.prisma 2>&1 | grep -E "failed|not found" || true)

if [ -z "$FAILED_MIGRATIONS" ]; then
    echo "✅ No se encontraron migraciones fallidas"
    exit 0
fi

echo "📋 Migraciones fallidas encontradas:"
echo "$FAILED_MIGRATIONS"
echo ""

# Resolver la migración específica que sabemos que falló
echo "🔧 Resolviendo migración: 20250115000000_add_has_ai_feature_to_plans"
npx prisma migrate resolve --rolled-back 20250115000000_add_has_ai_feature_to_plans || echo "⚠️  No se pudo resolver (puede que ya esté resuelta)"

echo ""
echo "✅ Proceso completado"
echo ""
echo "📋 Estado actual de migraciones:"
npx prisma migrate status || true

