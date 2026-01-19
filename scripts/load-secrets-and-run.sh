#!/bin/sh
# Script para cargar secrets desde TRABAJOYA_SECRETS y ejecutar un comando
# Este script es necesario porque Prisma CLI necesita las variables de entorno
# antes de que NestJS las cargue

# NO usar set -e aquí para permitir manejo de errores personalizado
set +e

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

# Función para verificar si estamos usando Cloud SQL a través de Cloud Run
is_cloud_run_cloud_sql() {
  # Verificar si existe el directorio /cloudsql (montado por Cloud Run)
  if [ -d "/cloudsql" ] && [ -n "$(ls -A /cloudsql 2>/dev/null)" ]; then
    echo "✅ Detectado Cloud SQL a través de Cloud Run (socket Unix)"
    return 0
  fi
  
  # Verificar si DATABASE_URL usa socket Unix
  if echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
    echo "✅ DATABASE_URL configurado para usar socket Unix de Cloud SQL"
    return 0
  fi
  
  # Verificar si la variable CLOUD_SQL_CONNECTION_NAME está configurada
  if [ -n "$CLOUD_SQL_CONNECTION_NAME" ]; then
    echo "✅ Variable CLOUD_SQL_CONNECTION_NAME detectada (Cloud Run Cloud SQL)"
    return 0
  fi
  
  return 1
}

# Función para verificar si Cloud SQL proxy está listo (solo para entornos locales)
wait_for_cloud_sql_proxy() {
  local max_wait=60
  local wait_interval=2
  local elapsed=0
  
  echo "🔍 Esperando a que Cloud SQL proxy esté disponible en 127.0.0.1:5432..."
  
  while [ $elapsed -lt $max_wait ]; do
    if command -v nc >/dev/null 2>&1; then
      if nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
        echo "✅ Cloud SQL proxy está disponible"
        return 0
      fi
    elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
      if timeout 1 bash -c "echo > /dev/tcp/127.0.0.1/5432" >/dev/null 2>&1; then
        echo "✅ Cloud SQL proxy está disponible"
        return 0
      fi
    fi
    
    echo "⏳ Esperando Cloud SQL proxy... (${elapsed}s/${max_wait}s)"
    sleep $wait_interval
    elapsed=$((elapsed + wait_interval))
  done
  
  echo "⚠️  Cloud SQL proxy no está disponible después de ${max_wait}s, pero continuando..."
  return 1
}

# Si el comando es prisma migrate deploy, agregar reintentos para errores de conexión
if echo "$@" | grep -q "prisma.*migrate"; then
  echo "📦 Detectado comando de migración..."
  
  if is_cloud_run_cloud_sql; then
    echo "✅ Usando Cloud SQL a través de Cloud Run, no se requiere proxy TCP"
    
    if [ -d "/cloudsql" ]; then
      echo "📁 Contenido de /cloudsql:"
      ls -la /cloudsql/ 2>/dev/null || echo "   (directorio vacío o no accesible)"
    fi
    
    # Guardar la URL original
    ORIGINAL_DATABASE_URL="$DATABASE_URL"
    export ORIGINAL_DATABASE_URL
    
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
    
    # Método 2: Desde variable de entorno
    if [ -z "$INSTANCE_CONNECTION_NAME" ] && [ -n "$CLOUD_SQL_CONNECTION_NAME" ]; then
      INSTANCE_CONNECTION_NAME="$CLOUD_SQL_CONNECTION_NAME"
      echo "✅ Nombre de conexión desde CLOUD_SQL_CONNECTION_NAME: ${INSTANCE_CONNECTION_NAME}"
    fi
    
    # Método 3: Buscar en variables de entorno
    if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
      for var in $(env | grep -i "cloud.*sql\|instance" | cut -d= -f1); do
        VALUE=$(eval echo \$$var)
        if echo "$VALUE" | grep -qE "^[^:]+:[^:]+:[^:]+$"; then
          INSTANCE_CONNECTION_NAME="$VALUE"
          echo "✅ Nombre de conexión en variable $var: ${INSTANCE_CONNECTION_NAME}"
          break
        fi
      done
    fi
    
    # Método 4: Construir desde PROJECT_ID
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
      else
        INSTANCE_CONNECTION_NAME="trabajo-ya-483316:us-central1:trabajoya-db"
        echo "🔧 Usando nombre conocido (fallback): ${INSTANCE_CONNECTION_NAME}"
      fi
    fi
    
    # Construir la ruta del socket y exportarla
    # PostgreSQL requiere el sufijo .s.PGSQL.5432 para sockets Unix
    CLOUD_SQL_PATH="/cloudsql/${INSTANCE_CONNECTION_NAME}/.s.PGSQL.5432"
    export CLOUD_SQL_PATH
    echo "📁 Ruta del socket: ${CLOUD_SQL_PATH}"
    
    # Verificar si el socket existe (puede estar en el directorio padre)
    SOCKET_DIR="/cloudsql/${INSTANCE_CONNECTION_NAME}"
    if [ -e "$CLOUD_SQL_PATH" ] || [ -e "$SOCKET_DIR" ] || [ -d "$SOCKET_DIR" ]; then
      echo "✅ Socket encontrado"
    else
      echo "⚠️  Socket no encontrado aún, pero continuando (puede estar montándose)"
      echo "⚠️  Cloud Run monta el socket en: ${SOCKET_DIR}"
    fi
    
    # Reconstruir DATABASE_URL con el formato correcto
    if [ -n "$DATABASE_URL" ]; then
      echo "🔧 Reconstruyendo DATABASE_URL para usar socket Unix..."
      # Exportar variables para que Node.js las pueda leer
      export CLOUD_SQL_PATH
      export DATABASE_URL=$(node <<NODE_SCRIPT
        const originalUrl = process.env.ORIGINAL_DATABASE_URL || '${DATABASE_URL}';
        const socketPath = process.env.CLOUD_SQL_PATH || '${CLOUD_SQL_PATH}';
        
        try {
          // Parsear URL manualmente para manejar caracteres especiales en password
          const regex = /^postgresql:\/\/([^:]+):(.+?)@([^\/]*?)(?:\/([^?]+))?(?:\?(.*))?$/;
          const match = originalUrl.match(regex);
          
          if (!match) {
            throw new Error('URL format not recognized');
          }
          
          const [, username, password, hostpart, database, params] = match;
          const db = database || 'trabajoya';
          
          // Codificar username y password para URL (necesario para caracteres especiales)
          const encodedUser = encodeURIComponent(username);
          const encodedPass = encodeURIComponent(password);
          
          // Parsear parámetros existentes (excluyendo host)
          const otherParams = [];
          if (params) {
            const pairs = params.split('&');
            for (const pair of pairs) {
              const [key, value] = pair.split('=');
              if (key && key !== 'host') {
                otherParams.push(\`\${key}=\${value || ''}\`);
              }
            }
          }
          
          // Construir parámetros: primero otros parámetros, luego host sin codificar
          const paramsStr = otherParams.length > 0 
            ? \`\${otherParams.join('&')}&host=\${socketPath}\`
            : \`host=\${socketPath}\`;
          
          // Formato correcto para Prisma con socket Unix:
          // postgresql://user:password@localhost/database?host=/cloudsql/INSTANCE
          // Prisma requiere localhost como hostname cuando se usa el parámetro host para socket Unix
          const newUrl = \`postgresql://\${encodedUser}:\${encodedPass}@localhost/\${db}?\${paramsStr}\`;
          
          console.log(newUrl);
        } catch (e) {
          console.error('Error parsing DATABASE_URL:', e.message);
          console.error('Original URL format:', originalUrl.replace(/:([^:@]+)@/, ':***@'));
          process.exit(1);
        }
NODE_SCRIPT
      )
      
      if [ $? -ne 0 ] || [ -z "$DATABASE_URL" ]; then
        echo "❌ ERROR: Falló la reconstrucción de DATABASE_URL"
        exit 1
      fi
      
      echo "✅ DATABASE_URL reconstruida correctamente"
    else
      echo "❌ ERROR: DATABASE_URL no está configurada"
      exit 1
    fi
    
    # Verificar que la URL reconstruida sea válida y mostrarla para debug
    if [ -n "$DATABASE_URL" ]; then
      echo "🔍 DATABASE_URL completa (para debug):"
      echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://***:***@|g'
      
      if ! echo "$DATABASE_URL" | grep -q "postgresql://"; then
        echo "❌ ERROR: DATABASE_URL no tiene formato válido"
        exit 1
      fi
      if ! echo "$DATABASE_URL" | grep -q "host="; then
        echo "❌ ERROR: DATABASE_URL no tiene parámetro host"
        exit 1
      fi
      # Verificación robusta del socket de Cloud SQL (puede estar codificado o no)
      if ! echo "$DATABASE_URL" | grep -qE "host=(/|%2F)cloudsql/"; then
        echo "❌ ERROR: DATABASE_URL no usa socket Unix de Cloud SQL"
        echo "💡 La URL debe tener formato: postgresql://user:pass@localhost/db?host=/cloudsql/INSTANCE"
        exit 1
      fi
      
      # Verificar que tenga localhost (Prisma requiere localhost cuando se usa socket Unix)
      if ! echo "$DATABASE_URL" | grep -qE "@localhost/"; then
        echo "⚠️  ADVERTENCIA: DATABASE_URL no contiene localhost"
        echo "💡 Prisma requiere localhost cuando se usa socket Unix"
      fi

    fi
  else
    echo "🔍 No se detectó Cloud SQL de Cloud Run, esperando proxy TCP..."
    wait_for_cloud_sql_proxy
  fi
  
  # Verificar que DATABASE_URL esté configurado
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está configurado"
    exit 1
  fi
  
  # Intentar con reintentos en caso de error de conexión
  MAX_RETRIES=5
  RETRY_DELAY=10
  ATTEMPT=1
  
  while [ $ATTEMPT -le $MAX_RETRIES ]; do
    echo "🔄 Intento $ATTEMPT de $MAX_RETRIES..."
    
    MIGRATE_OUTPUT=$(mktemp)
    "$@" > "$MIGRATE_OUTPUT" 2>&1
    MIGRATE_EXIT_CODE=$?
    
    cat "$MIGRATE_OUTPUT"
    
    if [ $MIGRATE_EXIT_CODE -eq 0 ]; then
      echo "✅ Migraciones ejecutadas exitosamente"
      rm -f "$MIGRATE_OUTPUT"
      exit 0
    fi
    
    CONNECTION_ERROR=$(grep -i "P1001\|P1013\|Can't reach database\|ECONNREFUSED\|connection.*refused\|timeout\|empty host" "$MIGRATE_OUTPUT" || true)
    
    if [ -n "$CONNECTION_ERROR" ]; then
      echo "⚠️  Error de conexión detectado:"
      echo "$CONNECTION_ERROR" | head -3
      
      if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        echo "⏳ Esperando ${RETRY_DELAY}s antes del siguiente intento..."
        rm -f "$MIGRATE_OUTPUT"
        sleep $RETRY_DELAY
        ATTEMPT=$((ATTEMPT + 1))
        continue
      else
        echo "❌ Se agotaron los ${MAX_RETRIES} intentos"
      fi
    else
      echo "❌ Error diferente a conexión detectado"
    fi
    
    rm -f "$MIGRATE_OUTPUT"
    echo "❌ Las migraciones fallaron con código $MIGRATE_EXIT_CODE después de $ATTEMPT intentos"
    
    if [ -n "$CLOUD_RUN_JOB" ] || [ -n "$CLOUD_RUN_EXECUTION" ]; then
      echo "📋 Ejecutándose en Cloud Run Job, saliendo con error para reintento"
      exit $MIGRATE_EXIT_CODE
    else
      echo "⚠️  No se detectó Cloud Run Job"
      exit $MIGRATE_EXIT_CODE
    fi
  done
  
  exit $MIGRATE_EXIT_CODE
else
  # Para otros comandos (como iniciar el servidor), ejecutar normalmente
  exec "$@"
fi