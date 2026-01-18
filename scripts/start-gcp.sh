#!/bin/sh
# Script de inicio optimizado para Cloud Run
# Ejecuta migraciones en background y inicia la aplicación rápidamente

echo "🚀 Iniciando aplicación TrabajoYa en Cloud Run..."
echo "📋 Variables de entorno:"
echo "   - PORT: ${PORT:-no configurado}"
echo "   - NODE_ENV: ${NODE_ENV:-no configurado}"
echo "   - DATABASE_URL: ${DATABASE_URL:+configurado (oculto por seguridad)}"

# Verificar que el archivo compilado existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado. La aplicación debe compilarse antes de ejecutarse."
  exit 1
fi

# Ejecutar migraciones en background (no bloqueante)
(
  echo "📦 Ejecutando migraciones en background..."
  npx prisma migrate deploy || {
    echo "⚠️  No se pudieron aplicar todas las migraciones, continuando..."
  }
  echo "✅ Migraciones completadas"
) &

# Iniciar servidor inmediatamente (no esperar migraciones)
echo "🚀 Iniciando servidor Node.js en puerto ${PORT:-8080}..."
exec node dist/main.js

