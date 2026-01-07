#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."

echo "⏳ Esperando a que la base de datos esté disponible..."
if [ -f "scripts/wait-for-db.js" ]; then
  node scripts/wait-for-db.js
else
  echo "⚠️  wait-for-db.js no encontrado, continuando..."
fi

# ✅ NO ejecutar migraciones aquí - se hacen en CodeBuild
echo "📦 Migraciones ya aplicadas en CI/CD"

echo "🌱 Verificando si se necesita ejecutar seed..."
# Solo en primera vez, con lock para evitar race conditions
if [ -f "dist/prisma/seed-if-empty.js" ]; then
  node dist/prisma/seed-if-empty.js || true
else
  echo "⚠️  seed-if-empty.js no encontrado, saltando seed..."
fi

echo "🎯 Iniciando aplicación NestJS..."
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado. Asegúrate de que la aplicación esté compilada."
  exit 1
fi

exec node dist/main.js