#!/bin/sh
# Script para cargar secrets desde TRABAJOYA_SECRETS y ejecutar un comando
# Este script es necesario porque Prisma CLI necesita las variables de entorno
# antes de que NestJS las cargue

set -e

echo "🔐 Cargando secrets desde TRABAJOYA_SECRETS..."

# Intentar cargar el secret desde diferentes ubicaciones posibles
SECRET_CONTENT=""

# 1. Intentar desde variable de entorno (Cloud Run monta secrets como variables)
if [ -n "$TRABAJOYA_SECRETS" ]; then
  echo "📦 Secret encontrado como variable de entorno"
  SECRET_CONTENT="$TRABAJOYA_SECRETS"
# 2. Intentar desde archivo montado (Cloud Run también puede montar como archivo)
elif [ -f "/etc/secrets/TRABAJOYA_SECRETS" ]; then
  echo "📦 Secret encontrado como archivo montado"
  SECRET_CONTENT=$(cat /etc/secrets/TRABAJOYA_SECRETS)
fi

# Si tenemos contenido del secret, parsearlo y exportar variables
if [ -n "$SECRET_CONTENT" ]; then
  echo "✅ Secret cargado, parseando JSON..."
  
  # Parsear JSON y exportar cada variable usando node
  # Pasamos el contenido como argumento para evitar problemas con caracteres especiales
  node -e "
    const fs = require('fs');
    const secretContent = process.argv[1];
    const secrets = JSON.parse(secretContent || '{}');
    const exports = [];
    
    Object.keys(secrets).forEach(key => {
      const value = String(secrets[key]);
      // Escapar correctamente para shell: reemplazar ' con '\'' y envolver en comillas simples
      const escaped = value.replace(/'/g, \"'\\\\''\");
      exports.push(\`export \${key}='\${escaped}'\`);
    });
    
    // Escribir a un archivo temporal
    fs.writeFileSync('/tmp/export-secrets.sh', exports.join('\\n') + '\\n');
    console.log(\`✅ Exportadas \${Object.keys(secrets).length} variables de entorno\`);
    console.log(\`📋 Variables: \${Object.keys(secrets).join(', ')}\`);
  " "$SECRET_CONTENT"
  
  # Ejecutar el script de exportación
  . /tmp/export-secrets.sh
  
  echo "✅ Variables de entorno cargadas desde secret"
else
  echo "⚠️  No se pudo cargar TRABAJOYA_SECRETS, usando variables de entorno existentes"
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está disponible"
    exit 1
  fi
fi

# Ejecutar el comando pasado como argumentos
echo "🚀 Ejecutando comando: $@"
exec "$@"

