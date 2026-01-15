#!/bin/sh
# Wrapper para prisma migrate deploy que resuelve migraciones fallidas primero

echo "🔧 Resolviendo migraciones fallidas antes de aplicar nuevas migraciones..."

# Resolver migraciones fallidas primero
./scripts/resolve-failed-migrations.sh || echo "⚠️  No se pudieron resolver todas las migraciones fallidas, continuando..."

# Ahora ejecutar prisma migrate deploy
echo "📦 Aplicando migraciones..."
npx prisma migrate deploy

# Ejecutar seed si la base de datos está vacía
echo "🌱 Verificando si necesitamos ejecutar seed..."
node scripts/seed-if-empty.js || {
  echo "⚠️  No se pudo ejecutar el seed (puede que la BD ya tenga datos o haya un error)"
}

