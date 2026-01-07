#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."

echo "⏳ Esperando a que la base de datos esté disponible..."
node scripts/wait-for-db.js

echo "📦 Ejecutando migraciones de Prisma..."
echo "   DATABASE_URL: ${DATABASE_URL:0:50}..."

if [ ! -d "prisma/migrations" ]; then
  echo "❌ ERROR: El directorio prisma/migrations no existe."
  ls -la prisma/ || true
  exit 1
fi

echo "   Aplicando migraciones pendientes..."
if ! npx prisma migrate deploy > /tmp/migrate_output.txt 2>&1; then
  echo "⚠️  prisma migrate deploy falló"
  cat /tmp/migrate_output.txt
else
  cat /tmp/migrate_output.txt
fi

echo "🌱 Verificando si se necesita ejecutar seed..."
node dist/prisma/seed-if-empty.js || true

echo "🎯 Iniciando aplicación NestJS..."
exec node dist/main.js
