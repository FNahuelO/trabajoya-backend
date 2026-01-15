#!/bin/sh
# Wrapper para prisma migrate deploy que resuelve migraciones fallidas primero

echo "🔧 Resolviendo migraciones fallidas antes de aplicar nuevas migraciones..."

# Resolver migraciones fallidas primero
./scripts/resolve-failed-migrations.sh || echo "⚠️  No se pudieron resolver todas las migraciones fallidas, continuando..."

# Asegurar que el esquema esté aplicado (verificar y crear tablas si no existen)
echo "🔍 Verificando y asegurando que el esquema esté aplicado..."
node scripts/ensure-schema.js || {
  echo "⚠️  Error al verificar/aplicar el esquema, intentando migrate deploy directo..."
  echo "📦 Aplicando migraciones..."
  npx prisma migrate deploy || {
    echo "❌ Error crítico: No se pudieron aplicar las migraciones"
    exit 1
  }
}

# Ejecutar seed si la base de datos está vacía
echo "🌱 Verificando si necesitamos ejecutar seed..."
node scripts/seed-if-empty.js || {
  echo "⚠️  No se pudo ejecutar el seed (puede que la BD ya tenga datos o haya un error)"
}

