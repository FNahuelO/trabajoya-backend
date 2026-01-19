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
      echo "📁 Contenido de /cloudsql:"
      ls -la /cloudsql/ 2>/dev/null || echo "   (directorio vacío o no accesible)"
      echo "📋 Variables de entorno relacionadas con Cloud SQL:"
      env | grep -i "cloud.*sql\|database" | sed 's/\(.*=\)\(.*\)/\1***/' || echo "   (ninguna encontrada)"
    fi
    
    # Verificar si DATABASE_URL ya está en formato socket Unix
    if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
      echo "✅ DATABASE_URL ya está configurada para usar socket Unix de Cloud SQL"
      # Extraer la ruta del socket para verificación
      # Usar Node.js para extraer el socket path de manera segura
      SOCKET_PATH=$(node <<NODE_SCRIPT
        const url = require('url');
        try {
          const parsed = new url.URL('${DATABASE_URL}');
          const hostParam = parsed.searchParams.get('host');
          if (hostParam) {
            console.log(hostParam);
          }
        } catch (e) {
          // Fallback: usar regex simple
          const match = '${DATABASE_URL}'.match(/host=([^&]*)/);
          if (match) {
            console.log(match[1]);
          }
        }
NODE_SCRIPT
      )
      
      if [ -n "$SOCKET_PATH" ]; then
        echo "📁 Socket configurado en: ${SOCKET_PATH}"
        # Verificar que el nombre de conexión sea correcto
        if echo "$SOCKET_PATH" | grep -q "trabajo-ya-483316:us-central1:trabajo-ya-483316"; then
          echo "⚠️  Detectado nombre de conexión incorrecto en DATABASE_URL"
          echo "⚠️  Debería ser: trabajo-ya-483316:us-central1:trabajoya-db"
          echo "🔧 Corrigiendo nombre de conexión usando Node.js..."
          CORRECT_SOCKET="/cloudsql/trabajo-ya-483316:us-central1:trabajoya-db"
          # Usar Node.js para reemplazar de manera segura
          export DATABASE_URL=$(node <<NODE_SCRIPT
            const url = require('url');
            const originalUrl = '${DATABASE_URL}';
            const correctSocket = '${CORRECT_SOCKET}';
            try {
              // Parsear la URL original
              const parsed = new url.URL(originalUrl);
              
              // Extraer componentes
              const protocol = parsed.protocol; // postgresql:
              const username = parsed.username;
              const password = parsed.password;
              const pathname = parsed.pathname; // /database
              const searchParams = new URLSearchParams(parsed.search);
              
              // Actualizar el parámetro host
              searchParams.set('host', correctSocket);
              
              // Construir la nueva URL manualmente para asegurar formato correcto
              // Formato: postgresql://user:password@/database?host=...&other_params
              const auth = password ? \`\${username}:\${password}\` : username;
              const queryString = searchParams.toString();
              const newUrl = \`\${protocol}//\${auth}@\${pathname}?\${queryString}\`;
              
              console.log(newUrl);
            } catch (e) {
              // Fallback: reemplazo simple con regex
              const corrected = originalUrl.replace(/host=[^&]*/, \`host=\${correctSocket}\`);
              console.log(corrected);
            }
NODE_SCRIPT
          )
          echo "✅ DATABASE_URL corregida"
        fi
      fi
    # Guardar la URL original antes de cualquier modificación
    ORIGINAL_DATABASE_URL="$DATABASE_URL"
    export ORIGINAL_DATABASE_URL
    
    # Ajustar DATABASE_URL para usar socket Unix si está configurada para TCP local
    elif [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "127.0.0.1\|localhost"; then
      echo "🔧 Ajustando DATABASE_URL para usar socket Unix de Cloud SQL..."
      
      # Buscar la ruta del socket de Cloud SQL
      # Cloud Run monta el socket en /cloudsql/[INSTANCE_CONNECTION_NAME]
      # Puede ser un directorio o el socket puede estar dentro de un directorio
      CLOUD_SQL_PATH=""
      
      if [ -d "/cloudsql" ]; then
        # Buscar cualquier elemento en /cloudsql que no sea README
        for item in /cloudsql/*; do
          if [ -e "$item" ] && [ "$(basename "$item")" != "README" ]; then
            # Si es un directorio, usarlo directamente
            if [ -d "$item" ]; then
              CLOUD_SQL_PATH="$item"
              break
            # Si es un archivo socket o cualquier otro archivo, usar el directorio padre
            elif [ -f "$item" ] || [ -S "$item" ]; then
              # El socket está en /cloudsql, así que usar el directorio /cloudsql
              # Pero necesitamos el nombre de la instancia, que es el nombre del archivo/directorio
              INSTANCE_NAME=$(basename "$item")
              CLOUD_SQL_PATH="/cloudsql/${INSTANCE_NAME}"
              break
            fi
          fi
        done
        
        # Si no encontramos nada específico, buscar directorios que contengan sockets
        if [ -z "$CLOUD_SQL_PATH" ]; then
          # Listar todos los elementos y tomar el primero que no sea README
          for item in /cloudsql/*; do
            if [ -e "$item" ] && [ "$(basename "$item")" != "README" ]; then
              CLOUD_SQL_PATH="/cloudsql/$(basename "$item")"
              break
            fi
          done
        fi
      fi
      
      if [ -n "$CLOUD_SQL_PATH" ]; then
        # Usar Node.js para parsear y reconstruir la URL de manera segura
        # Esto maneja correctamente caracteres especiales en contraseñas
        echo "🔧 Reconstruyendo DATABASE_URL con socket Unix usando Node.js..."
        export DATABASE_URL=$(node <<NODE_SCRIPT
          const url = require('url');
          const originalUrl = process.env.ORIGINAL_DATABASE_URL || '${DATABASE_URL}';
          try {
            const parsed = new url.URL(originalUrl);
            const socketPath = '${CLOUD_SQL_PATH}';
            
            // Extraer componentes de la URL original
            const protocol = parsed.protocol; // postgresql:
            const username = parsed.username;
            const password = parsed.password;
            const pathname = parsed.pathname || '/trabajoya'; // /database o /trabajoya
            const searchParams = new URLSearchParams(parsed.search);
            
            // Actualizar el parámetro host con el socket Unix
            searchParams.set('host', socketPath);
            
            // Construir la nueva URL manualmente para asegurar formato correcto
            // Formato: postgresql://user:password@/database?host=/cloudsql/INSTANCE&other_params
            const auth = password ? \`\${username}:\${password}\` : username;
            const queryString = searchParams.toString();
            const newUrl = \`\${protocol}//\${auth}@\${pathname}?\${queryString}\`;
            
            console.log(newUrl);
          } catch (e) {
            // Si falla el parsing, intentar método simple
            const match = originalUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^\/]+)?\/([^?]+)(\?.*)?$/);
            if (match) {
              const [, user, pass, , db, params] = match;
              const socketPath = '${CLOUD_SQL_PATH}';
              const paramsStr = params ? params.replace(/host=[^&]*/, '') : '';
              const newParams = paramsStr ? \`\${paramsStr}&host=\${socketPath}\` : \`host=\${socketPath}\`;
              console.log(\`postgresql://\${user}:\${pass}@/\${db}?\${newParams}\`);
            } else {
              console.error('Error parsing URL:', e.message);
              process.exit(1);
            }
          }
NODE_SCRIPT
        )
        echo "✅ DATABASE_URL ajustada para usar socket Unix: ${CLOUD_SQL_PATH}"
      else
        # Si no encontramos el socket, intentar construir la ruta desde variables de entorno
        # Cloud Run puede exponer información sobre la instancia
        if [ -n "$CLOUD_SQL_CONNECTION_NAME" ]; then
          CLOUD_SQL_PATH="/cloudsql/${CLOUD_SQL_CONNECTION_NAME}"
          echo "🔧 Usando CLOUD_SQL_CONNECTION_NAME para construir ruta: ${CLOUD_SQL_PATH}"
          
          # Usar Node.js para parsear y reconstruir la URL de manera segura
          export DATABASE_URL=$(node <<NODE_SCRIPT
            const url = require('url');
            const originalUrl = process.env.ORIGINAL_DATABASE_URL || '${DATABASE_URL}';
            const socketPath = '${CLOUD_SQL_PATH}';
            try {
              const parsed = new url.URL(originalUrl);
              
              // Extraer componentes
              const protocol = parsed.protocol;
              const username = parsed.username;
              const password = parsed.password;
              const pathname = parsed.pathname || '/trabajoya';
              const searchParams = new URLSearchParams(parsed.search);
              
              // Actualizar host
              searchParams.set('host', socketPath);
              
              // Construir URL manualmente
              const auth = password ? \`\${username}:\${password}\` : username;
              const queryString = searchParams.toString();
              const newUrl = \`\${protocol}//\${auth}@\${pathname}?\${queryString}\`;
              
              console.log(newUrl);
            } catch (e) {
              const match = originalUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^\/]+)?\/([^?]+)(\?.*)?$/);
              if (match) {
                const [, user, pass, , db, params] = match;
                const paramsStr = params ? params.replace(/host=[^&]*/, '') : '';
                const newParams = paramsStr ? \`\${paramsStr}&host=\${socketPath}\` : \`host=\${socketPath}\`;
                console.log(\`postgresql://\${user}:\${pass}@/\${db}?\${newParams}\`);
              } else {
                console.error('Error:', e.message);
                process.exit(1);
              }
            }
NODE_SCRIPT
          )
          echo "✅ DATABASE_URL ajustada usando CLOUD_SQL_CONNECTION_NAME: ${CLOUD_SQL_PATH}"
        else
          # Intentar obtener el nombre de la instancia desde los metadatos de Cloud Run
          echo "🔍 Intentando obtener información de la instancia de Cloud SQL..."
          
          # Cloud Run puede exponer información en variables de entorno o metadatos
          # Intentar obtener desde metadatos de la instancia
          INSTANCE_CONNECTION_NAME=""
          
          # Método 1: Intentar desde metadatos de Cloud Run (si están disponibles)
          if command -v curl >/dev/null 2>&1; then
            METADATA_INSTANCE=$(curl -s -H "Metadata-Flavor: Google" \
              "http://metadata.google.internal/computeMetadata/v1/instance/attributes/cloud-sql-instance" 2>/dev/null || echo "")
            if [ -n "$METADATA_INSTANCE" ]; then
              INSTANCE_CONNECTION_NAME="$METADATA_INSTANCE"
              echo "✅ Obtenido desde metadatos: ${INSTANCE_CONNECTION_NAME}"
            fi
          fi
          
          # Método 2: Intentar construir desde variables de entorno comunes
          if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
            # Buscar variables que contengan información de la instancia
            for var in $(env | grep -i "cloud.*sql\|instance" | cut -d= -f1); do
              VALUE=$(eval echo \$$var)
              if echo "$VALUE" | grep -qE "^[^:]+:[^:]+:[^:]+$"; then
                INSTANCE_CONNECTION_NAME="$VALUE"
                echo "✅ Encontrado en variable $var: ${INSTANCE_CONNECTION_NAME}"
                break
              fi
            done
          fi
          
          # Método 3: Construir desde el patrón común de Cloud SQL
          # Formato: PROJECT_ID:REGION:INSTANCE_NAME
          # Según cloudbuild.yaml: $PROJECT_ID:us-central1:trabajoya-db
          # Pero según la imagen del usuario: trabajo-ya-483316:us-central1:trabajoya-db
          if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
            # Intentar obtener PROJECT_ID desde variables de entorno
            if [ -n "$GOOGLE_CLOUD_PROJECT" ]; then
              PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
            elif [ -n "$GCP_PROJECT" ]; then
              PROJECT_ID="$GCP_PROJECT"
            elif [ -n "$PROJECT_ID" ]; then
              PROJECT_ID="$PROJECT_ID"
            else
              # Intentar desde metadatos
              if command -v curl >/dev/null 2>&1; then
                PROJECT_ID=$(curl -s -H "Metadata-Flavor: Google" \
                  "http://metadata.google.internal/computeMetadata/v1/project/project-id" 2>/dev/null || echo "")
              fi
            fi
            
            if [ -n "$PROJECT_ID" ]; then
              # Construir nombre de conexión con formato estándar
              # Asumir región us-central1 e instancia trabajoya-db (según cloudbuild.yaml)
              INSTANCE_CONNECTION_NAME="${PROJECT_ID}:us-central1:trabajoya-db"
              echo "🔧 Construyendo nombre de conexión: ${INSTANCE_CONNECTION_NAME}"
            else
              # Fallback: usar el nombre de conexión conocido según la configuración
              # trabajo-ya-483316:us-central1:trabajoya-db (según la imagen del usuario y cloudbuild.yaml)
              INSTANCE_CONNECTION_NAME="trabajo-ya-483316:us-central1:trabajoya-db"
              echo "🔧 Usando nombre de conexión conocido (fallback): ${INSTANCE_CONNECTION_NAME}"
            fi
          fi
          
          # Si tenemos el nombre de conexión, construir la ruta del socket
          if [ -n "$INSTANCE_CONNECTION_NAME" ]; then
            CLOUD_SQL_PATH="/cloudsql/${INSTANCE_CONNECTION_NAME}"
            echo "✅ Construyendo ruta del socket: ${CLOUD_SQL_PATH}"
            
            # Verificar si el socket existe (puede que no esté montado aún)
            if [ ! -e "$CLOUD_SQL_PATH" ] && [ ! -d "$CLOUD_SQL_PATH" ]; then
              echo "⚠️  El socket no existe aún en ${CLOUD_SQL_PATH}"
              echo "⚠️  Esto puede ser normal si Cloud Run aún está montando el socket"
              echo "⚠️  Intentando usar la ruta de todas formas..."
            fi
            
            # Construir DATABASE_URL con el socket Unix usando Node.js
            export DATABASE_URL=$(node <<NODE_SCRIPT
              const url = require('url');
              const originalUrl = process.env.ORIGINAL_DATABASE_URL || '${DATABASE_URL}';
              const socketPath = '${CLOUD_SQL_PATH}';
              try {
                const parsed = new url.URL(originalUrl);
                const newUrl = new url.URL(originalUrl);
                newUrl.hostname = '';
                newUrl.port = '';
                newUrl.searchParams.set('host', socketPath);
                const originalParams = new url.URL(originalUrl).searchParams;
                originalParams.forEach((value, key) => {
                  if (key !== 'host') {
                    newUrl.searchParams.set(key, value);
                  }
                });
                console.log(newUrl.toString());
              } catch (e) {
                const match = originalUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^\/]+)?\/([^?]+)(\?.*)?$/);
                if (match) {
                  const [, user, pass, , db, params] = match;
                  const paramsStr = params ? params.replace(/host=[^&]*/, '') : '';
                  const newParams = paramsStr ? \`\${paramsStr}&host=\${socketPath}\` : \`host=\${socketPath}\`;
                  console.log(\`postgresql://\${user}:\${pass}@/\${db}?\${newParams}\`);
                } else {
                  console.error('Error:', e.message);
                  process.exit(1);
                }
              }
NODE_SCRIPT
            )
            echo "✅ DATABASE_URL ajustada para usar socket Unix: ${CLOUD_SQL_PATH}"
          else
            echo "❌ No se pudo determinar el nombre de conexión de Cloud SQL"
            echo "⚠️  Intentando usar DATABASE_URL original, pero puede fallar si usa 127.0.0.1"
            echo "💡 Solución: Actualiza DATABASE_URL en los secrets con el formato:"
            echo "   postgresql://user:pass@/db?host=/cloudsql/trabajo-ya-483316:us-central1:trabajoya-db"
          fi
        fi
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
  echo "🔗 DATABASE_URL configurada (host oculto por seguridad):"
  echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://***:***@|g' | sed -E 's|host=([^&]+)|host=***|g'
  
  # Verificar si la URL usa socket Unix
  if echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
    echo "✅ DATABASE_URL usa socket Unix de Cloud SQL"
    CLOUD_SQL_SOCKET_PATH=$(echo "$DATABASE_URL" | sed -n 's|.*host=\([^&]*\).*|\1|p')
    if [ -n "$CLOUD_SQL_SOCKET_PATH" ]; then
      echo "📁 Verificando socket en: ${CLOUD_SQL_SOCKET_PATH}"
      if [ -e "$CLOUD_SQL_SOCKET_PATH" ] || [ -d "$CLOUD_SQL_SOCKET_PATH" ]; then
        echo "✅ Socket encontrado"
      else
        echo "⚠️  Socket no encontrado en la ruta especificada"
        echo "⚠️  Esto puede causar errores de conexión"
      fi
    fi
  elif echo "$DATABASE_URL" | grep -q "127.0.0.1\|localhost"; then
    echo "⚠️  DATABASE_URL usa TCP local (127.0.0.1 o localhost)"
    echo "⚠️  En Cloud Run con Cloud SQL, debería usar socket Unix: /cloudsql/INSTANCE"
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

