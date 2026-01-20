#!/bin/sh
# Script de inicio optimizado para Cloud Run
# Inicia la aplicación inmediatamente sin esperar migraciones

# Función para cargar secrets y exportar variables en el proceso actual
load_secrets() {
  echo "🔐 Cargando secrets antes de iniciar..."
  
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
    echo "✅ Secret cargado, detectando formato..."
    
    # Guardar el contenido en un archivo temporal para evitar problemas con caracteres especiales
    echo "$SECRET_CONTENT" > /tmp/secret-content.txt
    
    # Detectar si es JSON o formato KEY=VALUE usando el archivo
    node <<'NODE_SCRIPT'
      const fs = require('fs');
      const secretContent = fs.readFileSync('/tmp/secret-content.txt', 'utf8');
      const exports = [];
      let secrets = {};
      let format = 'unknown';
      
      // Intentar parsear como JSON
      try {
        secrets = JSON.parse(secretContent.trim());
        if (typeof secrets === 'object' && !Array.isArray(secrets)) {
          format = 'json';
        }
      } catch (e) {
        // No es JSON, será formato KEY=VALUE
        format = 'env';
      }
      
      if (format === 'json') {
        // Procesar como JSON
        Object.keys(secrets).forEach(key => {
          const value = String(secrets[key]);
          const escaped = value.replace(/'/g, "'\\''");
          exports.push(`export ${key}='${escaped}'`);
        });
        console.log(`✅ Formato JSON detectado, exportadas ${Object.keys(secrets).length} variables`);
      } else {
        // Procesar como formato KEY=VALUE (variables de entorno)
        const lines = secretContent.split('\n');
        const keys = [];
        lines.forEach(line => {
          line = line.trim();
          if (line && !line.startsWith('#')) {
            // Buscar el primer = que separa la clave del valor
            const eqIndex = line.indexOf('=');
            if (eqIndex > 0) {
              const key = line.substring(0, eqIndex).trim();
              let value = line.substring(eqIndex + 1);
              
              // Validar que la clave sea un identificador válido
              if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
                // Remover comillas externas si están presentes (simples o dobles)
                if ((value.startsWith('"') && value.endsWith('"') && value.length > 1) || 
                    (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
                  value = value.slice(1, -1);
                }
                // Escapar para shell
                const escaped = value.replace(/'/g, "'\\''");
                exports.push(`export ${key}='${escaped}'`);
                keys.push(key);
              }
            }
          }
        });
        console.log(`✅ Formato KEY=VALUE detectado, exportadas ${keys.length} variables`);
      }
      
      // Escribir a un archivo temporal
      fs.writeFileSync('/tmp/export-secrets.sh', exports.join('\n') + '\n');
NODE_SCRIPT
    
    # Ejecutar el script de exportación en el proceso actual (usar source en lugar de ejecutar)
    . /tmp/export-secrets.sh
    
    echo "✅ Variables de entorno cargadas desde secret"
    rm -f /tmp/secret-content.txt /tmp/export-secrets.sh
  else
    echo "⚠️  No se pudo cargar TRABAJOYA_SECRETS, usando variables de entorno existentes"
    if [ -z "$DATABASE_URL" ]; then
      echo "❌ ERROR: DATABASE_URL no está disponible"
      exit 1
    fi
  fi
}

# Función para configurar DATABASE_URL para usar socket Unix de Cloud SQL
configure_database_url() {
  # Solo configurar si DATABASE_URL existe y estamos en Cloud Run con Cloud SQL
  if [ -z "$DATABASE_URL" ]; then
    return 0
  fi
  
  # Verificar si Cloud SQL está disponible a través de Cloud Run
  if [ -d "/cloudsql" ] && [ -n "$(ls -A /cloudsql 2>/dev/null)" ]; then
    echo "✅ Detectado Cloud SQL a través de Cloud Run (socket Unix)"
    
    # Determinar el nombre de conexión de Cloud SQL
    INSTANCE_CONNECTION_NAME=""
    
    # Método 1: Desde metadatos de Cloud Run
    if command -v curl >/dev/null 2>&1; then
      METADATA_INSTANCE=$(curl -s -H "Metadata-Flavor: Google" \
        "http://metadata.google.internal/computeMetadata/v1/instance/attributes/cloud-sql-instance" 2>/dev/null || echo "")
      if [ -n "$METADATA_INSTANCE" ]; then
        INSTANCE_CONNECTION_NAME="$METADATA_INSTANCE"
        echo "✅ Nombre de conexión desde metadatos: ${INSTANCE_CONNECTION_NAME}"
      fi
    fi
    
    # Método 2: Buscar en directorio /cloudsql
    if [ -z "$INSTANCE_CONNECTION_NAME" ] && [ -d "/cloudsql" ]; then
      # Buscar el primer directorio/socket en /cloudsql
      FIRST_SOCKET=$(ls -1 /cloudsql 2>/dev/null | head -1)
      if [ -n "$FIRST_SOCKET" ]; then
        # Remover sufijos comunes como .s.PGSQL.5432
        INSTANCE_CONNECTION_NAME=$(echo "$FIRST_SOCKET" | sed 's/\.s\.PGSQL\.5432$//')
        echo "✅ Nombre de conexión detectado desde /cloudsql: ${INSTANCE_CONNECTION_NAME}"
      fi
    fi
    
    # Método 3: Construir desde PROJECT_ID si está disponible
    if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
      if [ -n "$GOOGLE_CLOUD_PROJECT" ]; then
        PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
      elif [ -n "$GCP_PROJECT" ]; then
        PROJECT_ID="$GCP_PROJECT"
      elif [ -n "$PROJECT_ID" ]; then
        PROJECT_ID="$PROJECT_ID"
      else
        if command -v curl >/dev/null 2>&1; then
          PROJECT_ID=$(curl -s -H "Metadata-Flavor: Google" \
            "http://metadata.google.internal/computeMetadata/v1/project/project-id" 2>/dev/null || echo "")
        fi
      fi
      
      if [ -n "$PROJECT_ID" ]; then
        INSTANCE_CONNECTION_NAME="${PROJECT_ID}:us-central1:trabajoya-db"
        echo "🔧 Nombre construido desde PROJECT_ID: ${INSTANCE_CONNECTION_NAME}"
      fi
    fi
    
    if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
      echo "⚠️  No se pudo determinar el nombre de conexión de Cloud SQL, usando DATABASE_URL original"
      return 0
    fi
    
    # Construir la ruta del socket
    CLOUD_SQL_PATH="/cloudsql/${INSTANCE_CONNECTION_NAME}"
    export CLOUD_SQL_PATH
    
    # Verificar si el socket existe
    if [ -e "$CLOUD_SQL_PATH" ] || [ -d "$CLOUD_SQL_PATH" ]; then
      echo "✅ Socket encontrado en: ${CLOUD_SQL_PATH}"
    else
      echo "⚠️  Socket no encontrado aún en ${CLOUD_SQL_PATH}, pero continuando (puede estar montándose)"
    fi
    
    # Reconstruir DATABASE_URL con el formato correcto para socket Unix
    echo "🔧 Configurando DATABASE_URL para usar socket Unix..."
    export ORIGINAL_DATABASE_URL="$DATABASE_URL"
    
    export DATABASE_URL=$(ORIGINAL_DATABASE_URL="$DATABASE_URL" CLOUD_SQL_PATH="$CLOUD_SQL_PATH" node <<'NODE_SCRIPT'
      const originalUrl = process.env.ORIGINAL_DATABASE_URL || '';
      const socketPath = process.env.CLOUD_SQL_PATH || '';
      
      if (!originalUrl) {
        console.error('Error: ORIGINAL_DATABASE_URL está vacío');
        process.exit(1);
      }
      
      if (!socketPath) {
        console.error('Error: CLOUD_SQL_PATH está vacío');
        process.exit(1);
      }
      
      try {
        // Parsear URL manualmente para manejar caracteres especiales en password
        const regex = /^postgresql:\/\/([^:]+):(.+?)@([^\/]*?)(?:\/([^?]+))?(?:\?(.*))?$/;
        const match = originalUrl.match(regex);
        
        if (!match) {
          throw new Error('URL format not recognized');
        }
        
        const [, username, password, hostpart, database, params] = match;
        const db = database || 'trabajoya';
        
        // Codificar username y password para URL
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);
        
        // Parsear parámetros existentes (excluyendo host)
        const otherParams = [];
        if (params) {
          const pairs = params.split('&');
          for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && key !== 'host') {
              otherParams.push(`${key}=${value || ''}`);
            }
          }
        }
        
        // Construir parámetros: primero otros parámetros, luego host sin codificar
        const paramsStr = otherParams.length > 0 
          ? `${otherParams.join('&')}&host=${socketPath}`
          : `host=${socketPath}`;
        
        // Formato correcto para Prisma con socket Unix:
        // postgresql://user:password@/database?host=/cloudsql/INSTANCE
        const newUrl = `postgresql://${encodedUser}:${encodedPass}@/${db}?${paramsStr}`;
        
        console.log(newUrl);
      } catch (e) {
        console.error('Error parsing DATABASE_URL:', e.message);
        console.error('Original URL format:', originalUrl.replace(/:([^:@]+)@/, ':***@'));
        process.exit(1);
      }
NODE_SCRIPT
    )
    
    if [ $? -eq 0 ] && [ -n "$DATABASE_URL" ]; then
      echo "✅ DATABASE_URL configurada para usar socket Unix"
      echo "🔍 DATABASE_URL formateada correctamente (oculto por seguridad)"
    else
      echo "⚠️  No se pudo configurar DATABASE_URL para socket Unix, usando original"
      DATABASE_URL="$ORIGINAL_DATABASE_URL"
      export DATABASE_URL
    fi
  else
    echo "ℹ️  No se detectó Cloud SQL de Cloud Run, usando DATABASE_URL original"
  fi
}

# Cargar secrets primero si están disponibles
echo "🔍 Verificando disponibilidad de TRABAJOYA_SECRETS..."
echo "🔍 Variables de entorno iniciales:"
env | grep -i "TRABAJOYA\|DATABASE\|PRISMA" | head -5 || echo "   (ninguna variable relevante encontrada)"

if [ -n "$TRABAJOYA_SECRETS" ]; then
  echo "✅ TRABAJOYA_SECRETS encontrado como variable de entorno (longitud: ${#TRABAJOYA_SECRETS})"
  load_secrets
elif [ -f "/etc/secrets/TRABAJOYA_SECRETS" ]; then
  echo "✅ TRABAJOYA_SECRETS encontrado como archivo en /etc/secrets/TRABAJOYA_SECRETS"
  load_secrets
elif [ -d "/etc/secrets" ]; then
  echo "📁 Directorio /etc/secrets existe, listando contenido:"
  ls -la /etc/secrets/ || echo "   (no se pudo listar)"
  # Intentar encontrar cualquier archivo de secret
  if [ -n "$(ls -A /etc/secrets 2>/dev/null)" ]; then
    echo "📦 Intentando cargar primer archivo encontrado en /etc/secrets..."
    FIRST_SECRET=$(ls -1 /etc/secrets/ | head -1)
    if [ -n "$FIRST_SECRET" ]; then
      echo "📦 Cargando $FIRST_SECRET..."
      TRABAJOYA_SECRETS=$(cat "/etc/secrets/$FIRST_SECRET")
      load_secrets
    fi
  else
    echo "⚠️  Directorio /etc/secrets está vacío"
  fi
else
  echo "⚠️  TRABAJOYA_SECRETS no encontrado ni como variable ni como archivo"
  echo "⚠️  Directorio /etc/secrets no existe"
fi

# Configurar DATABASE_URL para Cloud SQL si es necesario
configure_database_url

# Establecer DATABASE_URL como variable principal (Prisma schema usa DATABASE_URL)
# También establecer PRISMA_DATABASE_URL para compatibilidad futura
if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL="$DATABASE_URL"
  # También establecer PRISMA_DATABASE_URL como copia para compatibilidad
  export PRISMA_DATABASE_URL="$DATABASE_URL"
  echo "✅ DATABASE_URL configurada (variable principal para Prisma)"
  echo "✅ PRISMA_DATABASE_URL configurada (compatibilidad)"
else
  echo "❌ ERROR: DATABASE_URL no está configurada después de cargar secrets"
  echo "🔍 Verificando si TRABAJOYA_SECRETS está disponible..."
  if [ -n "$TRABAJOYA_SECRETS" ]; then
    echo "⚠️  TRABAJOYA_SECRETS existe pero DATABASE_URL no se cargó correctamente"
    echo "💡 Primeros 100 caracteres de TRABAJOYA_SECRETS para debug:"
    echo "${TRABAJOYA_SECRETS:0:100}..."
    echo "💡 Verifica que el secret contenga DATABASE_URL en formato KEY=VALUE o JSON"
  elif [ -f "/etc/secrets/TRABAJOYA_SECRETS" ]; then
    echo "⚠️  TRABAJOYA_SECRETS existe como archivo pero DATABASE_URL no se cargó correctamente"
    echo "💡 Primeros 100 caracteres del archivo para debug:"
    head -c 100 /etc/secrets/TRABAJOYA_SECRETS || echo "   (no se pudo leer)"
    echo "..."
  else
    echo "⚠️  TRABAJOYA_SECRETS no está disponible como variable de entorno ni como archivo"
  fi
  exit 1
fi

# Verificar que DATABASE_URL esté realmente configurada antes de iniciar
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR CRÍTICO: DATABASE_URL no está configurada después de todos los intentos"
  exit 1
fi

echo "🚀 Iniciando aplicación TrabajoYa en Cloud Run..."
echo "📋 Variables de entorno:"
echo "   - PORT: ${PORT:-8080}"
echo "   - NODE_ENV: ${NODE_ENV:-production}"
echo "   - DATABASE_URL: ${DATABASE_URL:+configurado (oculto por seguridad)}"
echo "   - PRISMA_DATABASE_URL: ${PRISMA_DATABASE_URL:+configurado (oculto por seguridad)}"
echo "   - TRABAJOYA_SECRETS: ${TRABAJOYA_SECRETS:+disponible}"

# Verificar que el archivo compilado existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ Error: dist/main.js no encontrado. La aplicación debe compilarse antes de ejecutarse."
  exit 1
fi

# Verificar una vez más que la variable crítica esté disponible
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR CRÍTICO: DATABASE_URL no está configurada"
  echo "🔍 Variables de entorno disponibles:"
  env | grep -i "DATABASE\|PRISMA" || echo "   (ninguna encontrada)"
  exit 1
fi

# Asegurar que PRISMA_DATABASE_URL también esté disponible para compatibilidad
if [ -z "$PRISMA_DATABASE_URL" ] && [ -n "$DATABASE_URL" ]; then
  export PRISMA_DATABASE_URL="$DATABASE_URL"
  echo "✅ PRISMA_DATABASE_URL configurada desde DATABASE_URL (compatibilidad)"
fi

# Verificación final antes de iniciar Node.js
echo "🔍 Verificación final de variables críticas:"
echo "   - DATABASE_URL: ${DATABASE_URL:+✅ configurado (oculto por seguridad)}"
echo "   - PRISMA_DATABASE_URL: ${PRISMA_DATABASE_URL:+✅ configurado (oculto por seguridad)}"
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está configurada correctamente"
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

# Exportar variables de entorno explícitamente para que Node.js las tenga disponibles
# CRÍTICO: Asegurar que DATABASE_URL esté disponible antes de iniciar Node.js
export DATABASE_URL
export PRISMA_DATABASE_URL

# Verificación final antes de ejecutar Node.js
echo "🔍 Verificación final antes de iniciar Node.js:"
echo "   - DATABASE_URL está ${DATABASE_URL:+✅ configurado}"
echo "   - PRISMA_DATABASE_URL está ${PRISMA_DATABASE_URL:+✅ configurado}"
echo "   - TRABAJOYA_SECRETS está ${TRABAJOYA_SECRETS:+✅ disponible}"

# Verificar que DATABASE_URL está realmente disponible en el entorno
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR CRÍTICO: DATABASE_URL no está disponible antes de iniciar Node.js"
  echo "🔍 Variables de entorno relacionadas con DATABASE:"
  env | grep -i "DATABASE\|PRISMA" || echo "   (ninguna encontrada)"
  exit 1
fi

# Asegurar que las variables estén disponibles en el entorno de Node.js
# CRÍTICO: PrismaClient se inicializa inmediatamente al importar, así que las variables
# DEBEN estar disponibles antes de que Node.js cargue cualquier módulo
export DATABASE_URL
export PRISMA_DATABASE_URL

# Verificar una última vez que DATABASE_URL está disponible
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR FATAL: DATABASE_URL no está disponible en el entorno justo antes de iniciar Node.js"
  echo "🔍 Estado del entorno:"
  env | grep -i "DATABASE\|PRISMA\|TRABAJOYA" || echo "   (ninguna variable relacionada encontrada)"
  exit 1
fi

# Imprimir confirmación final (sin mostrar el valor por seguridad)
echo "✅ Confirmación final: DATABASE_URL está configurada (longitud: ${#DATABASE_URL} caracteres)"
echo "🚀 Iniciando Node.js con DATABASE_URL disponible en el entorno..."

# Iniciar el servidor Node.js - usar exec para que reciba señales correctamente
# CRÍTICO: Usar exec para reemplazar el shell actual y pasar el entorno completo
# Las variables exportadas estarán disponibles en process.env
exec node dist/main.js

