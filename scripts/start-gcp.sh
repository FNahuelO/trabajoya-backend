#!/bin/sh
# Script de inicio optimizado para Cloud Run
# Inicia la aplicación inmediatamente sin esperar migraciones

# Cargar secrets primero si están disponibles
if [ -n "$TRABAJOYA_SECRETS" ] || [ -f "/etc/secrets/TRABAJOYA_SECRETS" ]; then
  echo "🔐 Cargando secrets antes de iniciar..."
  ./scripts/load-secrets-and-run.sh echo "✅ Secrets cargados" > /dev/null 2>&1 || {
    echo "⚠️  No se pudieron cargar secrets, continuando con variables existentes..."
  }
fi

echo "🚀 Iniciando aplicación TrabajoYa en Cloud Run..."
echo "📋 Variables de entorno:"
echo "   - PORT: ${PORT:-8080}"
echo "   - NODE_ENV: ${NODE_ENV:-production}"
echo "   - DATABASE_URL: ${DATABASE_URL:+configurado (oculto por seguridad)}"

# Verificar que el archivo compilado existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado. La aplicación debe compilarse antes de ejecutarse."
  exit 1
fi

# Ejecutar migraciones en background (completamente asíncrono, no bloquea)
echo "📦 Iniciando migraciones en background (no bloqueante)..."
nohup sh -c "
  sleep 10
  echo '📦 Ejecutando migraciones de base de datos...'
  # Usar load-secrets-and-run.sh para asegurar que los secrets estén cargados
  if [ -f './scripts/load-secrets-and-run.sh' ]; then
    ./scripts/load-secrets-and-run.sh npx prisma migrate deploy 2>&1 || echo '⚠️  No se pudieron aplicar todas las migraciones'
  else
    npx prisma migrate deploy 2>&1 || echo '⚠️  No se pudieron aplicar todas las migraciones'
  fi
  echo '✅ Migraciones completadas'
" > /tmp/migrations.log 2>&1 &

# Iniciar servidor inmediatamente (no esperar migraciones)
echo "🚀 Iniciando servidor Node.js en puerto ${PORT:-8080}..."
echo "⏱️  El servidor iniciará inmediatamente, las migraciones continúan en background"
echo "🏥 Health check disponible en: http://0.0.0.0:${PORT:-8080}/api/public/health"

# Iniciar el servidor Node.js - usar exec para que reciba señales correctamente
exec node dist/main.js

