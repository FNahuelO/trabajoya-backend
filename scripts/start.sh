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

# Paso 3: Iniciar servidor
echo "🌱 Paso 3: Iniciando servidor Node.js..."
exec node dist/main.js

