#!/bin/sh
# Script de inicio completo que resuelve migraciones fallidas y luego inicia la aplicación

# No usar set -e aquí porque queremos manejar errores manualmente

echo "🚀 Iniciando aplicación TrabajoYa..."

# Paso 1: Resolver migraciones fallidas (no crítico si falla)
echo "🔧 Paso 1: Resolviendo migraciones fallidas..."
./scripts/resolve-failed-migrations.sh || {
  echo "⚠️  No se pudieron resolver todas las migraciones fallidas, continuando..."
}

# Paso 2: Asegurar que el esquema esté aplicado (verificar y crear tablas si no existen)
echo "🔍 Paso 2: Verificando y asegurando que el esquema esté aplicado..."
if ! node scripts/ensure-schema.js; then
  echo "⚠️  Error al verificar/aplicar el esquema, intentando db push directo..."
  echo "📦 Sincronizando esquema con db push..."
  if ! npx prisma db push --accept-data-loss --skip-generate; then
    echo "⚠️  db push falló, intentando migrate deploy..."
    if ! npx prisma migrate deploy; then
      echo "❌ Error crítico: No se pudieron aplicar las migraciones ni sincronizar el esquema"
      exit 1
    fi
  fi
fi

# Paso 2.5: Siempre ejecutar migrate deploy para aplicar migraciones pendientes
echo "📦 Aplicando migraciones pendientes..."
if ! npx prisma migrate deploy; then
  echo "⚠️  No se pudieron aplicar todas las migraciones, pero continuando..."
fi

echo "✅ Esquema verificado/aplicado correctamente"

# Paso 3: Ejecutar seed si la base de datos está vacía
echo "🌱 Paso 3: Verificando si necesitamos ejecutar seed..."
node scripts/seed-if-empty.js || {
  echo "⚠️  No se pudo ejecutar el seed (puede que la BD ya tenga datos o haya un error)"
}

# Paso 4: Iniciar servidor
echo "🚀 Paso 4: Iniciando servidor Node.js..."
exec node dist/main.js

