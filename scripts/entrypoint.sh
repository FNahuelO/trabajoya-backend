#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."
echo "📁 Directorio actual: $(pwd)"
echo "📋 Contenido del directorio:"
ls -la || echo "No se pudo listar directorio"

echo "⏳ Esperando a que la base de datos esté disponible..."
if [ -f "./scripts/wait-for-db.js" ]; then
  echo "✅ Ejecutando wait-for-db.js..."
  node ./scripts/wait-for-db.js
elif [ -f "scripts/wait-for-db.js" ]; then
  echo "✅ Ejecutando scripts/wait-for-db.js..."
  node scripts/wait-for-db.js
else
  echo "⚠️  wait-for-db.js no encontrado, continuando..."
fi

# ✅ Ejecutar migraciones antes de iniciar la app (opción más económica)
echo "🔄 Ejecutando migraciones de base de datos..."
echo "📂 Verificando Prisma..."
if [ -f "./node_modules/.bin/prisma" ]; then
  echo "✅ Prisma encontrado en node_modules/.bin/prisma"
  ./node_modules/.bin/prisma migrate deploy || {
    echo "⚠️  Error al ejecutar migraciones. La app continuará pero puede fallar si la DB no está actualizada."
  }
elif command -v npx > /dev/null 2>&1; then
  echo "✅ Usando npx para ejecutar Prisma..."
  npx prisma migrate deploy || {
    echo "⚠️  Error al ejecutar migraciones. La app continuará pero puede fallar si la DB no está actualizada."
  }
else
  echo "⚠️  Prisma no encontrado. Saltando migraciones."
  echo "📋 Node modules:"
  ls -la node_modules/.bin/ 2>/dev/null | head -10 || echo "No se pudo listar node_modules"
fi

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