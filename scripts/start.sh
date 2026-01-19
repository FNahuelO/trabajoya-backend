#!/bin/sh
# Script de inicio para desarrollo local (Docker)

echo "🚀 Iniciando aplicación TrabajoYa..."

# Verificar que el archivo compilado existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado. La aplicación debe compilarse antes de ejecutarse."
  exit 1
fi

# Ejecutar migraciones antes de iniciar (en desarrollo es seguro esperar)
echo "📦 Ejecutando migraciones..."
npx prisma migrate deploy || echo "⚠️  No se pudieron aplicar todas las migraciones"

# Ejecutar seed si la DB está vacía
echo "🌱 Verificando si necesitamos ejecutar seed..."
node scripts/seed-if-empty.js || echo "⚠️  Seed no ejecutado (DB ya tiene datos o error)"

# Iniciar servidor
echo "🚀 Iniciando servidor Node.js..."
exec node dist/main.js

