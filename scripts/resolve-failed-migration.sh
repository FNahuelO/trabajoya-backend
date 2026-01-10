#!/bin/sh
set -e

echo "🔧 Resolviendo migración fallida en producción..."
echo ""
echo "Este script marca la migración fallida como resuelta."
echo "Solo úsalo si estás seguro de que quieres limpiar el estado de migraciones."
echo ""
read -p "¿Continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔍 Resolviendo migración fallida..."
npx prisma migrate resolve --rolled-back 20250115000000_add_has_ai_feature_to_plans

echo ""
echo "✅ Migración fallida marcada como resuelta"
echo ""
echo "📋 Estado actual de migraciones:"
npx prisma migrate status

echo ""
echo "✅ Listo. Ahora puedes ejecutar 'npx prisma migrate deploy' para aplicar las migraciones pendientes."

