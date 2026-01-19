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
# En Cloud Run Jobs con --add-cloudsql-instances, Cloud Run monta automáticamente
# un socket Unix en /cloudsql/[INSTANCE_CONNECTION_NAME] y NO usa proxy TCP
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
    # Intentar conectar al puerto usando nc (netcat) si está disponible, o con timeout/telnet
    if command -v nc >/dev/null 2>&1; then
      if nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
        echo "✅ Cloud SQL proxy está disponible"
        return 0
      fi
    elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
      # Usar timeout con bash para verificar conexión
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
  
  # Verificar si estamos usando Cloud SQL a través de Cloud Run (socket Unix)
  # En ese caso, NO esperar proxy TCP ya que Cloud Run maneja la conexión automáticamente
  if is_cloud_run_cloud_sql; then
    echo "✅ Usando Cloud SQL a través de Cloud Run, no se requiere proxy TCP"
    # Opcional: Verificar que el socket esté disponible
    if [ -d "/cloudsql" ]; then
      echo "📁 Sockets disponibles en /cloudsql:"
      ls -la /cloudsql/ 2>/dev/null || echo "   (directorio vacío o no accesible)"
    fi
    
    # Ajustar DATABASE_URL para usar socket Unix si está configurada para TCP local
    if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "127.0.0.1\|localhost"; then
      echo "🔧 Ajustando DATABASE_URL para usar socket Unix de Cloud SQL..."
      
      # Buscar el directorio del socket de Cloud SQL
      # Cloud Run monta el socket en /cloudsql/[INSTANCE_CONNECTION_NAME]
      CLOUD_SQL_DIR=""
      if [ -d "/cloudsql" ]; then
        # Obtener el primer directorio disponible (normalmente hay uno)
        CLOUD_SQL_DIR=$(ls -d /cloudsql/* 2>/dev/null | head -1)
      fi
      
      if [ -n "$CLOUD_SQL_DIR" ] && [ -d "$CLOUD_SQL_DIR" ]; then
        # Extraer componentes de la URL original
        # Formato: postgresql://user:password@host:port/database?params
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
        DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
        DB_PARAMS=$(echo "$DATABASE_URL" | sed -n 's|.*?\(.*\)|\1|p')
        
        # Construir nueva URL con socket Unix
        # Formato para Prisma: postgresql://user:password@/database?host=/cloudsql/INSTANCE
        if [ -n "$DB_PARAMS" ] && echo "$DB_PARAMS" | grep -vq "host="; then
          export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=${CLOUD_SQL_DIR}&${DB_PARAMS}"
        elif [ -n "$DB_PARAMS" ]; then
          # Si ya tiene host=, reemplazarlo
          export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?$(echo "$DB_PARAMS" | sed "s|host=[^&]*|host=${CLOUD_SQL_DIR}|g")"
        else
          export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=${CLOUD_SQL_DIR}"
        fi
        echo "✅ DATABASE_URL ajustada para usar socket Unix: ${CLOUD_SQL_DIR}"
      else
        echo "⚠️  No se encontró directorio de socket de Cloud SQL, usando DATABASE_URL original"
        echo "⚠️  Asegúrate de que DATABASE_URL en los secrets use el formato correcto para Cloud SQL"
      fi
    fi
  else
    # Solo esperar proxy TCP si NO estamos en Cloud Run con Cloud SQL
    echo "🔍 No se detectó Cloud SQL de Cloud Run, esperando proxy TCP..."
    wait_for_cloud_sql_proxy
  fi
  
  # Verificar que DATABASE_URL esté configurado
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está configurado"
    exit 1
  fi
  
  # Mostrar información de depuración (sin mostrar credenciales)
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  if [ -n "$DB_HOST" ]; then
    echo "🔗 DATABASE_URL configurado para host: $DB_HOST"
  fi
  
  # Intentar con reintentos en caso de error de conexión
  MAX_RETRIES=5
  RETRY_DELAY=10
  ATTEMPT=1
  
  while [ $ATTEMPT -le $MAX_RETRIES ]; do
    echo "🔄 Intento $ATTEMPT de $MAX_RETRIES..."
    
    # Capturar tanto el código de salida como la salida del comando
    MIGRATE_OUTPUT=$(mktemp)
    "$@" > "$MIGRATE_OUTPUT" 2>&1
    MIGRATE_EXIT_CODE=$?
    
    # Mostrar la salida del comando
    cat "$MIGRATE_OUTPUT"
    
    if [ $MIGRATE_EXIT_CODE -eq 0 ]; then
      echo "✅ Migraciones ejecutadas exitosamente"
      rm -f "$MIGRATE_OUTPUT"
      exit 0
    fi
    
    # Verificar si es un error de conexión (P1001, Can't reach, ECONNREFUSED, etc.)
    CONNECTION_ERROR=$(grep -i "P1001\|Can't reach database\|ECONNREFUSED\|connection.*refused\|timeout" "$MIGRATE_OUTPUT" || true)
    
    if [ -n "$CONNECTION_ERROR" ]; then
      echo "⚠️  Error de conexión a la base de datos detectado:"
      echo "$CONNECTION_ERROR" | head -1
      
      if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        echo "⏳ Esperando ${RETRY_DELAY}s antes del siguiente intento..."
        rm -f "$MIGRATE_OUTPUT"
        sleep $RETRY_DELAY
        ATTEMPT=$((ATTEMPT + 1))
        continue
      else
        echo "❌ Se agotaron los ${MAX_RETRIES} intentos de conexión"
      fi
    else
      # Error diferente a conexión
      echo "❌ Error diferente a conexión detectado"
    fi
    
    rm -f "$MIGRATE_OUTPUT"
    
    # Si llegamos aquí, fue un error diferente o se agotaron los reintentos
    echo "❌ Las migraciones fallaron con código $MIGRATE_EXIT_CODE después de $ATTEMPT intentos"
    
    # Para Jobs de Cloud Run, queremos que falle para que se reintente el Job completo
    # Para el servicio principal (que no debería ejecutar migraciones), también fallar
    # Cloud Run Jobs tienen estas variables de entorno
    if [ -n "$CLOUD_RUN_JOB" ] || [ -n "$CLOUD_RUN_EXECUTION" ]; then
      echo "📋 Ejecutándose en Cloud Run Job, saliendo con error para reintento del Job"
      exit $MIGRATE_EXIT_CODE
    else
      echo "⚠️  No se detectó que es un Job de Cloud Run"
      echo "⚠️  Esto no debería pasar si las migraciones se ejecutan como Job separado"
      exit $MIGRATE_EXIT_CODE
    fi
  done
  
  exit $MIGRATE_EXIT_CODE
else
  # Para otros comandos (como iniciar el servidor), ejecutar normalmente
  exec "$@"
fi

