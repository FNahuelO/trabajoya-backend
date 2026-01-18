#!/bin/sh
# Script de inicio optimizado para Cloud Run
# Ejecuta migraciones en background y inicia la aplicación rápidamente

echo "🚀 Iniciando aplicación TrabajoYa en Cloud Run..."

# Ejecutar migraciones en background (no bloqueante)
(
  echo "📦 Ejecutando migraciones en background..."
  npx prisma migrate deploy || {
    echo "⚠️  No se pudieron aplicar todas las migraciones, continuando..."
  }
  echo "✅ Migraciones completadas"
) &

# Iniciar servidor inmediatamente (no esperar migraciones)
echo "🚀 Iniciando servidor Node.js..."
exec node dist/main.js

