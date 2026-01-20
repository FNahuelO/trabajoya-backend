#!/bin/sh
# Script de inicio simplificado para Cloud Run
# Cloud Run monta los secretos automáticamente como variables de entorno

set -e

echo "🚀 Iniciando TrabajoYa Backend..."

# Debug: Mostrar variables críticas (sin valores por seguridad)
echo "🔍 Verificando variables de entorno..."
echo "   DATABASE_URL: ${DATABASE_URL:+✅ configurada (${#DATABASE_URL} caracteres)}"
echo "   NODE_ENV: ${NODE_ENV:-production}"
echo "   PORT: ${PORT:-8080}"

# Verificación crítica
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está configurada"
  echo "🔍 Variables disponibles:"
  env | grep -E "DATABASE|SECRET|PRISMA" || echo "   Ninguna encontrada"
  exit 1
fi

# Verificar que el archivo compilado existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado"
  exit 1
fi

echo "✅ Todas las verificaciones pasaron"

# Iniciar aplicación
echo "🚀 Iniciando servidor en puerto ${PORT:-8080}..."
exec node dist/main.js