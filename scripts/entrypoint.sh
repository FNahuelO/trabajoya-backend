#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."

# Esperar a que la base de datos esté disponible
if [ -f "./scripts/wait-for-db.js" ]; then
  node ./scripts/wait-for-db.js >/dev/null 2>&1 || node scripts/wait-for-db.js >/dev/null 2>&1 || true
fi

# Ejecutar migraciones
echo "📦 Verificando estado de migraciones..."
if [ -f "./node_modules/.bin/prisma" ]; then
  echo "🔍 Ejecutando: ./node_modules/.bin/prisma migrate deploy"
  ./node_modules/.bin/prisma migrate deploy || npx prisma migrate deploy || true
elif command -v npx >/dev/null 2>&1; then
  echo "🔍 Ejecutando: npx prisma migrate deploy"
  npx prisma migrate deploy || true
else
  echo "⚠️  Prisma no encontrado, saltando migraciones"
fi
echo "✅ Migraciones completadas"

# Ejecutar seed si existe
[ -f "dist/prisma/seed-if-empty.js" ] && node dist/prisma/seed-if-empty.js >/dev/null 2>&1 || true

# Verificar que la aplicación esté compilada
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado"
  exit 1
fi

# Iniciar aplicación
exec node dist/main.js