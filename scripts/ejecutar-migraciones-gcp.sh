#!/bin/bash
# Script para ejecutar migraciones de Prisma en Cloud Run

echo "🔌 Ejecutando migraciones de Prisma en Cloud SQL..."

# Verificar que DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no está configurado"
  exit 1
fi

echo "📦 Ejecutando migraciones..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migraciones ejecutadas exitosamente"
  echo "📊 Verificando estado..."
  npx prisma migrate status
else
  echo "❌ Error al ejecutar migraciones"
  exit 1
fi

