#!/bin/sh
# Script de inicio completo que resuelve migraciones fallidas y luego inicia la aplicación

set -e  # Salir si cualquier comando falla (excepto los que usan ||)

echo "🚀 Iniciando aplicación TrabajoYa..."

# Paso 1: Resolver migraciones fallidas (no crítico si falla)
echo "🔧 Paso 1: Resolviendo migraciones fallidas..."
./scripts/resolve-failed-migrations.sh || {
  echo "⚠️  No se pudieron resolver todas las migraciones fallidas, continuando..."
}

# Paso 2: Aplicar migraciones
echo "📦 Paso 2: Aplicando migraciones de Prisma..."
npx prisma migrate deploy || {
  echo "❌ Error al aplicar migraciones"
  exit 1
}

echo "✅ Migraciones aplicadas correctamente"

# Paso 3: Ejecutar seed si la base de datos está vacía
echo "🌱 Paso 3: Verificando si necesitamos ejecutar seed..."
node scripts/seed-if-empty.js || {
  echo "⚠️  No se pudo ejecutar el seed (puede que la BD ya tenga datos o haya un error)"
}

# Paso 4: Iniciar servidor
echo "🚀 Paso 4: Iniciando servidor Node.js..."
exec node dist/main.js

