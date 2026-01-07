#!/bin/bash
set -e

TARGET_IMAGE="${REPOSITORY_URI}:${IMAGE_TAG}"
CONTAINER_NAME="${PROJECT_NAME:-trabajoya-prod}-backend"
DEPLOY_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
APP_CONFIG_SECRET_ID="${APP_CONFIG_SECRET_ID:-/trabajoya-prod/app/config}"
DB_CREDENTIALS_SECRET_ID="${DB_CREDENTIALS_SECRET_ID:-/trabajoya-prod/database/credentials}"
CONTAINER_PORT="${CONTAINER_PORT:-4000}"

echo "Deploy: $TARGET_IMAGE -> $CONTAINER_NAME:$CONTAINER_PORT"

if [ -n "${EC2_INSTANCE_ID:-}" ]; then
  INSTANCE_IDS="$EC2_INSTANCE_ID"
else
  ASG_NAMES=$(aws autoscaling describe-auto-scaling-groups \
    --query "AutoScalingGroups[?contains(AutoScalingGroupName,'trabajoya')||contains(AutoScalingGroupName,'prod')].AutoScalingGroupName" \
    --output text 2>/dev/null || echo "")
  INSTANCE_IDS=""
  if [ -n "$ASG_NAMES" ]; then
    for ASG_NAME in $ASG_NAMES; do
      ASG_INSTANCES=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --query "AutoScalingGroups[0].Instances[?HealthStatus=='Healthy'&&LifecycleState=='InService'].InstanceId" \
        --output text 2>/dev/null || echo "")
      if [ -n "$ASG_INSTANCES" ]; then
        INSTANCE_IDS="$INSTANCE_IDS $ASG_INSTANCES"
      fi
    done
  fi
fi

if [ -z "$INSTANCE_IDS" ]; then
  echo "No se encontraron instancias activas"
  exit 0
fi

echo "Instancias: $INSTANCE_IDS"

# Validar que las variables necesarias están definidas
if [ -z "$REPOSITORY_URI" ] || [ -z "$IMAGE_TAG" ]; then
  echo "❌ Error: REPOSITORY_URI o IMAGE_TAG no están definidas"
  echo "   REPOSITORY_URI=${REPOSITORY_URI:-undefined}"
  echo "   IMAGE_TAG=${IMAGE_TAG:-undefined}"
  exit 1
fi

# Validar que TARGET_IMAGE está correctamente formado
if [[ ! "$TARGET_IMAGE" =~ ^[^:]+:[^:]+$ ]]; then
  echo "❌ Error: TARGET_IMAGE tiene formato incorrecto: $TARGET_IMAGE"
  exit 1
fi

# Crear el script remoto con las variables sustituidas
# FIXED: Removed problematic "..." line that was causing the error
cat > /tmp/remote_update.sh << 'EOF'
#!/bin/bash
set -e

# Función para hacer flush de la salida inmediatamente
flush_output() {
  sync
}

# Log inmediato al inicio para verificar que el script se ejecuta
echo "🚀 Script remoto iniciado en $(date)"
flush_output
echo "📋 Información del sistema:"
echo "   Hostname: $(hostname)"
echo "   Usuario: $(whoami)"
echo "   Directorio actual: $(pwd)"
echo "   Bash version: $BASH_VERSION"
echo "   PATH: $PATH"
echo ""

# These variables will be substituted when the heredoc is created
REGION="DEPLOY_REGION_PLACEHOLDER"
TARGET_IMAGE="TARGET_IMAGE_PLACEHOLDER"
CONTAINER_NAME="CONTAINER_NAME_PLACEHOLDER"
APP_CONFIG_SECRET_ID="APP_CONFIG_SECRET_ID_PLACEHOLDER"
DB_CREDENTIALS_SECRET_ID="DB_CREDENTIALS_SECRET_ID_PLACEHOLDER"
PORT="CONTAINER_PORT_PLACEHOLDER"

echo "✅ Variables configuradas:"
echo "   REGION=$REGION"
echo "   TARGET_IMAGE=$TARGET_IMAGE"
echo "   CONTAINER_NAME=$CONTAINER_NAME"
echo "   PORT=$PORT"

echo "Actualizando contenedor $CONTAINER_NAME..."
flush_output

# Instalar jq si no existe
echo "🔍 Verificando herramientas necesarias..."
echo "   jq: $(command -v jq || echo 'no encontrado')"
echo "   docker: $(command -v docker || echo 'no encontrado')"
echo "   aws: $(command -v aws || echo 'no encontrado')"
flush_output

if ! command -v jq >/dev/null 2>&1; then
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y jq >/dev/null 2>&1 || true
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y jq >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y jq >/dev/null 2>&1 || true
  fi
fi

echo "🔐 Obteniendo Account ID de AWS..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ No se pudo obtener Account ID"
  echo "   Intentando con detalles del error:"
  aws sts get-caller-identity 2>&1
  exit 1
fi
echo "✅ Account ID obtenido: $ACCOUNT_ID"
flush_output

echo "🔐 Haciendo login a ECR..."
ECR_LOGIN_OUTPUT=$(aws ecr get-login-password --region "$REGION" 2>&1)
if [ $? -ne 0 ]; then
  echo "❌ Error al obtener password de ECR:"
  echo "$ECR_LOGIN_OUTPUT"
  exit 1
fi

DOCKER_LOGIN_OUTPUT=$(echo "$ECR_LOGIN_OUTPUT" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com" 2>&1)
if [ $? -ne 0 ]; then
  echo "❌ Error al hacer login a ECR con Docker:"
  echo "$DOCKER_LOGIN_OUTPUT"
  exit 1
fi
echo "✅ Login a ECR exitoso"
flush_output

echo "📥 Descargando imagen: $TARGET_IMAGE"

# Extraer nombre del repositorio y tag
FULL_REPO=$(echo "$TARGET_IMAGE" | cut -d':' -f1)
REPO_NAME=$(echo "$FULL_REPO" | cut -d'/' -f2)
ORIGINAL_TAG=$(echo "$TARGET_IMAGE" | cut -d':' -f2)

echo "   Repositorio completo: $FULL_REPO"
echo "   Nombre del repo: $REPO_NAME"
echo "   Tag original: $ORIGINAL_TAG"

# Esperar para que ECR indexe la imagen
echo "⏳ Esperando 15 segundos para que ECR indexe la imagen..."
sleep 15

PULL_SUCCESS=false
MAX_PULL_RETRIES=8
PULL_RETRY_COUNT=0

# Intentar con el tag original
while [ $PULL_RETRY_COUNT -lt $MAX_PULL_RETRIES ] && [ "$PULL_SUCCESS" = "false" ]; do
  echo "🔄 Intento $((PULL_RETRY_COUNT + 1)) de $MAX_PULL_RETRIES: Intentando pull de $TARGET_IMAGE..."
  set +e
  PULL_OUTPUT=$(docker pull "$TARGET_IMAGE" 2>&1)
  PULL_EXIT_CODE=$?
  set -e
  
  if [ $PULL_EXIT_CODE -eq 0 ]; then
    PULL_SUCCESS=true
    echo "✅ Imagen $TARGET_IMAGE descargada correctamente"
    echo "$PULL_OUTPUT"
    break
  else
    PULL_RETRY_COUNT=$((PULL_RETRY_COUNT + 1))
    echo "⚠️  Pull falló (exit code: $PULL_EXIT_CODE)"
    echo "📋 Output completo del pull:"
    echo "$PULL_OUTPUT"
    if [ $PULL_RETRY_COUNT -lt $MAX_PULL_RETRIES ]; then
      echo "⏳ Esperando 8 segundos antes de reintentar..."
      sleep 8
    fi
  fi
done

# Si el pull del tag original falló, intentar con latest
if [ "$PULL_SUCCESS" = "false" ] && [ "$ORIGINAL_TAG" != "latest" ]; then
  echo "🔄 El tag original falló, intentando con 'latest' como fallback..."
  LATEST_IMAGE="${TARGET_IMAGE%:*}:latest"
  PULL_RETRY_COUNT=0
  
  while [ $PULL_RETRY_COUNT -lt $MAX_PULL_RETRIES ] && [ "$PULL_SUCCESS" = "false" ]; do
    echo "🔄 Intento $((PULL_RETRY_COUNT + 1)) de $MAX_PULL_RETRIES: Intentando pull de $LATEST_IMAGE..."
    set +e
    PULL_OUTPUT=$(docker pull "$LATEST_IMAGE" 2>&1)
    PULL_EXIT_CODE=$?
    set -e
    
    if [ $PULL_EXIT_CODE -eq 0 ]; then
      PULL_SUCCESS=true
      TARGET_IMAGE="$LATEST_IMAGE"
      ORIGINAL_TAG="latest"
      echo "✅ Imagen :latest descargada como fallback"
      echo "$PULL_OUTPUT"
      break
    else
      PULL_RETRY_COUNT=$((PULL_RETRY_COUNT + 1))
      echo "⚠️  Pull de latest falló (exit code: $PULL_EXIT_CODE)"
      echo "📋 Output completo del pull:"
      echo "$PULL_OUTPUT"
      if [ $PULL_RETRY_COUNT -lt $MAX_PULL_RETRIES ]; then
        echo "⏳ Esperando 8 segundos antes de reintentar..."
        sleep 8
      fi
    fi
  done
fi

# Si todo falló, mostrar información de diagnóstico
if [ "$PULL_SUCCESS" = "false" ]; then
  echo "❌ Error: No se pudo descargar ninguna imagen después de todos los intentos"
  echo "📋 Último output del pull:"
  echo "$PULL_OUTPUT" | tail -10
  echo ""
  echo "🔍 Diagnóstico:"
  echo "   Intentando listar imágenes en ECR..."
  aws ecr describe-images --repository-name "$REPO_NAME" --region "$REGION" --query 'imageDetails[*].[imageTags[0],imagePushedAt]' --output table 2>/dev/null | head -15 || echo "   No se pudieron listar imágenes"
  echo ""
  echo "   Verificando login a ECR..."
  docker images "${FULL_REPO}" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" 2>/dev/null | head -5 || echo "   No hay imágenes locales de este repositorio"
  exit 1
fi

# Verificar que la imagen se descargó
IMAGE_ID=$(docker images "$TARGET_IMAGE" --format "{{.ID}}" | head -1)
if [ -z "$IMAGE_ID" ]; then
  echo "❌ Error: La imagen $TARGET_IMAGE no se encuentra localmente después del pull"
  docker images "${TARGET_IMAGE%:*}" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | head -10
  exit 1
fi

IMAGE_CREATED=$(docker images "$TARGET_IMAGE" --format "{{.CreatedAt}}" | head -1)
echo "✅ Imagen descargada: $TARGET_IMAGE"
echo "   ID: $IMAGE_ID"
echo "   Creada: $IMAGE_CREATED"

# Obtener configuración desde Secrets Manager
if command -v jq >/dev/null 2>&1; then
  APP_CONFIG_JSON=$(aws secretsmanager get-secret-value --secret-id "$APP_CONFIG_SECRET_ID" --query SecretString --output text 2>/dev/null || echo "")
  [ -n "$APP_CONFIG_JSON" ] && [ "$APP_CONFIG_JSON" != "None" ] && \
    while IFS= read -r line; do [ -n "$line" ] && export "$line"; done < <(echo "$APP_CONFIG_JSON" | jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]' 2>/dev/null || echo "")
  
  DB_JSON=$(aws secretsmanager get-secret-value --secret-id "$DB_CREDENTIALS_SECRET_ID" --query SecretString --output text 2>/dev/null || echo "")
  if [ -n "$DB_JSON" ] && [ "$DB_JSON" != "None" ]; then
    DB_HOST=$(echo "$DB_JSON" | jq -r '.host // .endpoint // empty' 2>/dev/null || echo "")
    DB_PORT=$(echo "$DB_JSON" | jq -r '.port // "5432"' 2>/dev/null || echo "5432")
    DB_NAME=$(echo "$DB_JSON" | jq -r '.dbname // .database // empty' 2>/dev/null || echo "")
    DB_USER=$(echo "$DB_JSON" | jq -r '.username // .user // empty' 2>/dev/null || echo "")
    DB_PASS=$(echo "$DB_JSON" | jq -r '.password // .pass // empty' 2>/dev/null || echo "")
    [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASS" ] && \
      export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
  fi
fi

echo "🛑 Deteniendo y eliminando contenedor antiguo..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
sleep 1
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
sleep 1

# Verificar que el contenedor fue eliminado
if docker ps -a --format "{{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
  echo "⚠️  El contenedor aún existe, forzando eliminación..."
  docker rm -f "$CONTAINER_NAME" || true
  sleep 1
fi

# Limpiar imágenes antiguas
echo "🧹 Limpiando imágenes Docker antiguas..."
docker image prune -f >/dev/null 2>&1 || true

# Construir comando docker run
DOCKER_ENV_ARGS=(
  "-e" "NODE_ENV=production"
)

if [ -n "${DATABASE_URL:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "DATABASE_URL=$DATABASE_URL")
fi

if [ -n "${JWT_ACCESS_SECRET:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET")
fi

if [ -n "${JWT_REFRESH_SECRET:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET")
fi

if [ -n "${AWS_REGION:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "AWS_REGION=$AWS_REGION")
fi

echo "🚀 Creando nuevo contenedor con imagen: $TARGET_IMAGE"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$PORT:$PORT" \
  "${DOCKER_ENV_ARGS[@]}" \
  "$TARGET_IMAGE" || { 
    echo "❌ Error al crear contenedor"
    docker images "$TARGET_IMAGE" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}"
    exit 1
  }

sleep 2

# Verificar que el contenedor está usando la imagen correcta
CONTAINER_IMAGE=$(docker inspect "$CONTAINER_NAME" --format "{{.Config.Image}}" 2>/dev/null || echo "")
if [ -z "$CONTAINER_IMAGE" ]; then
  echo "❌ Error: No se pudo obtener información del contenedor"
  exit 1
fi

if [ "$CONTAINER_IMAGE" != "$TARGET_IMAGE" ]; then
  echo "⚠️  ADVERTENCIA: El contenedor está usando $CONTAINER_IMAGE en lugar de $TARGET_IMAGE"
  echo "🔄 Reintentando con la imagen correcta..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$PORT:$PORT" \
    "${DOCKER_ENV_ARGS[@]}" \
    "$TARGET_IMAGE" || { echo "❌ Error al recrear contenedor"; exit 1; }
  sleep 2
  CONTAINER_IMAGE=$(docker inspect "$CONTAINER_NAME" --format "{{.Config.Image}}" 2>/dev/null || echo "")
fi

echo "✅ Contenedor actualizado correctamente"
echo "📦 Imagen configurada: $TARGET_IMAGE"
echo "📦 Imagen en uso: $CONTAINER_IMAGE"
echo "📊 Estado del contenedor:"
docker ps --filter name="$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
EOF

# Sustituir placeholders con valores reales
echo "🔧 Sustituyendo variables en el script remoto..."
echo "   DEPLOY_REGION=$DEPLOY_REGION"
echo "   TARGET_IMAGE=$TARGET_IMAGE"
echo "   CONTAINER_NAME=$CONTAINER_NAME"
echo "   APP_CONFIG_SECRET_ID=$APP_CONFIG_SECRET_ID"
echo "   DB_CREDENTIALS_SECRET_ID=$DB_CREDENTIALS_SECRET_ID"
echo "   CONTAINER_PORT=$CONTAINER_PORT"

sed -i "s|DEPLOY_REGION_PLACEHOLDER|$DEPLOY_REGION|g" /tmp/remote_update.sh
sed -i "s|TARGET_IMAGE_PLACEHOLDER|$TARGET_IMAGE|g" /tmp/remote_update.sh
sed -i "s|CONTAINER_NAME_PLACEHOLDER|$CONTAINER_NAME|g" /tmp/remote_update.sh
sed -i "s|APP_CONFIG_SECRET_ID_PLACEHOLDER|$APP_CONFIG_SECRET_ID|g" /tmp/remote_update.sh
sed -i "s|DB_CREDENTIALS_SECRET_ID_PLACEHOLDER|$DB_CREDENTIALS_SECRET_ID|g" /tmp/remote_update.sh
sed -i "s|CONTAINER_PORT_PLACEHOLDER|$CONTAINER_PORT|g" /tmp/remote_update.sh

# Verificar que las sustituciones funcionaron
if grep -q "PLACEHOLDER" /tmp/remote_update.sh; then
  echo "⚠️  ADVERTENCIA: Algunos placeholders no se sustituyeron correctamente"
  grep "PLACEHOLDER" /tmp/remote_update.sh | head -5
fi

# Mostrar primeras líneas del script para verificar
echo "📄 Primeras 10 líneas del script remoto (después de sustituciones):"
head -10 /tmp/remote_update.sh | sed 's/^/   /'
echo "📊 Tamaño del script remoto: $(wc -l < /tmp/remote_update.sh) líneas, $(wc -c < /tmp/remote_update.sh) bytes"

# Codificar el script en base64
echo "📦 Codificando script en base64..."
SCRIPT_B64=$(base64 -w 0 /tmp/remote_update.sh 2>/dev/null || base64 /tmp/remote_update.sh | tr -d '\n')
SCRIPT_SIZE=${#SCRIPT_B64}
echo "   Script codificado: $SCRIPT_SIZE caracteres en base64"

# Construir JSON de forma segura
if command -v jq >/dev/null 2>&1; then
  PARAMS_JSON=$(jq -n --arg cmd "echo '$SCRIPT_B64' | base64 -d > /tmp/update_remote.sh && chmod +x /tmp/update_remote.sh && /tmp/update_remote.sh" '{"commands":[$cmd]}')
else
  PARAMS_JSON="{\"commands\":[\"echo '$SCRIPT_B64' | base64 -d > /tmp/update_remote.sh && chmod +x /tmp/update_remote.sh && /tmp/update_remote.sh\"]}"
fi

for INSTANCE_ID in $INSTANCE_IDS; do
  echo "Actualizando $INSTANCE_ID..."
  
  # Verificar que el script remoto se generó correctamente
  if [ ! -f /tmp/remote_update.sh ] || [ ! -s /tmp/remote_update.sh ]; then
    echo "❌ Error: El script remoto no se generó correctamente"
    exit 1
  fi
  
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "$PARAMS_JSON" \
    --timeout-seconds 900 \
    --query "Command.CommandId" \
    --output text 2>&1)
  
  if [ -z "$COMMAND_ID" ] || [ "$COMMAND_ID" = "None" ] || echo "$COMMAND_ID" | grep -qi "error"; then
    echo "❌ Error enviando comando SSM: $COMMAND_ID"
    aws ssm send-command \
      --instance-ids "$INSTANCE_ID" \
      --document-name "AWS-RunShellScript" \
      --parameters "$PARAMS_JSON" \
      --timeout-seconds 900 2>&1 | head -20
    continue
  fi
  
  echo "✅ Comando SSM enviado, CommandId: $COMMAND_ID"
  echo "📋 URL del comando en AWS Console: https://$DEPLOY_REGION.console.aws.amazon.com/systems-manager/run-command/$COMMAND_ID?region=$DEPLOY_REGION"
  
  WAIT_COUNT=0
  MAX_WAIT=24
  LAST_OUTPUT=""
  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    sleep 10
    STATUS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'Status' --output text 2>/dev/null || echo "Pending")
    
    # Intentar obtener salida parcial incluso si está en progreso
    if [ "$STATUS" = "InProgress" ] || [ "$STATUS" = "Pending" ]; then
      CURRENT_OUTPUT=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null | tail -20 || echo "")
      CURRENT_ERRORS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null || echo "")
      
      # Si hay nueva salida, mostrarla
      if [ -n "$CURRENT_OUTPUT" ] && [ "$CURRENT_OUTPUT" != "$LAST_OUTPUT" ]; then
        echo "📋 Salida parcial del script remoto:"
        echo "$CURRENT_OUTPUT" | tail -10 | sed 's/^/   /'
        LAST_OUTPUT="$CURRENT_OUTPUT"
      fi
      
      if [ -n "$CURRENT_ERRORS" ]; then
        echo "⚠️  Errores parciales detectados:"
        echo "$CURRENT_ERRORS" | tail -5 | sed 's/^/   /'
      fi
    fi
    
    if [ "$STATUS" = "Success" ]; then
      echo "✅ $INSTANCE_ID actualizada"
      echo "📋 Salida completa del deployment:"
      OUTPUT=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null || echo "")
      if [ -n "$OUTPUT" ]; then
        echo "$OUTPUT"
      else
        echo "(Sin salida estándar)"
      fi
      echo ""
      echo "📋 Errores (si hay):"
      ERRORS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null || echo "")
      if [ -n "$ERRORS" ]; then
        echo "$ERRORS"
      else
        echo "Ninguno"
      fi
      break
    elif [ "$STATUS" = "Failed" ]; then
      echo "❌ $INSTANCE_ID falló"
      echo "📋 Salida de error completa:"
      ERRORS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null || echo "")
      if [ -n "$ERRORS" ]; then
        echo "$ERRORS"
      else
        echo "(Sin errores capturados)"
      fi
      echo ""
      echo "📋 Salida estándar completa:"
      OUTPUT=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null || echo "")
      if [ -n "$OUTPUT" ]; then
        echo "$OUTPUT"
      else
        echo "(Sin salida estándar)"
      fi
      break
    elif [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "TimedOut" ]; then
      echo "⚠️  $INSTANCE_ID: $STATUS"
      echo "📋 Salida disponible:"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null || echo "(Sin salida disponible)"
      break
    else
      if [ $((WAIT_COUNT % 3)) -eq 0 ]; then
        echo "⏳ Esperando... Estado: $STATUS (intento $((WAIT_COUNT + 1))/$MAX_WAIT)"
      fi
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
  
    if [ "$STATUS" != "Success" ] && [ "$STATUS" != "Failed" ] && [ "$STATUS" != "Cancelled" ] && [ "$STATUS" != "TimedOut" ]; then
      echo "⚠️  Tiempo de espera agotado para $INSTANCE_ID. Estado final: ${STATUS:-Unknown}"
      echo ""
      echo "📋 Información completa del comando:"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" 2>/dev/null || echo "   No se pudo obtener información del comando"
      echo ""
      echo "📋 Salida estándar disponible:"
      OUTPUT_FINAL=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null || echo "")
      if [ -n "$OUTPUT_FINAL" ]; then
        echo "$OUTPUT_FINAL"
      else
        echo "   (Sin salida estándar disponible todavía)"
      fi
      echo ""
      echo "📋 Salida de error disponible:"
      ERRORS_FINAL=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null || echo "")
      if [ -n "$ERRORS_FINAL" ]; then
        echo "$ERRORS_FINAL"
      else
        echo "   (Sin errores capturados todavía)"
      fi
      echo ""
      echo "🔍 Verificando si el comando sigue ejecutándose..."
      aws ssm list-command-invocations --command-id "$COMMAND_ID" --details --output json 2>/dev/null | head -30 || echo "   No se pudo listar invocaciones del comando"
    fi
done

echo "Deployment completado"