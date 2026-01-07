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

# Crear el script remoto con las variables sustituidas
cat > /tmp/remote_update.sh << EOF
#!/bin/bash
set -e

REGION="${DEPLOY_REGION}"
TARGET_IMAGE="${TARGET_IMAGE}"
CONTAINER_NAME="${CONTAINER_NAME}"
APP_CONFIG_SECRET_ID="${APP_CONFIG_SECRET_ID}"
DB_CREDENTIALS_SECRET_ID="${DB_CREDENTIALS_SECRET_ID}"
PORT="${CONTAINER_PORT}"

echo "Actualizando contenedor \$CONTAINER_NAME..."

# Instalar jq si no existe
if ! command -v jq >/dev/null 2>&1; then
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y jq >/dev/null 2>&1 || true
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y jq >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y jq >/dev/null 2>&1 || true
  fi
fi

ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
[ -z "\$ACCOUNT_ID" ] && { echo "❌ No se pudo obtener Account ID"; exit 1; }

aws ecr get-login-password --region "\$REGION" | docker login --username AWS --password-stdin "\$ACCOUNT_ID.dkr.ecr.\$REGION.amazonaws.com" >/dev/null 2>&1 || { echo "❌ Error al hacer login a ECR"; exit 1; }

echo "📥 Descargando imagen: \$TARGET_IMAGE"

# Extraer nombre del repositorio y tag de forma más robusta
# Formato esperado: ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPO_NAME:TAG
FULL_REPO=\$(echo "\$TARGET_IMAGE" | cut -d':' -f1)
REPO_NAME=\$(echo "\$FULL_REPO" | cut -d'/' -f2)
ORIGINAL_TAG=\$(echo "\$TARGET_IMAGE" | cut -d':' -f2)

echo "   Repositorio completo: \$FULL_REPO"
echo "   Nombre del repo: \$REPO_NAME"
echo "   Tag original: \$ORIGINAL_TAG"

# Esperar un poco para que ECR indexe la imagen
echo "⏳ Esperando 15 segundos para que ECR indexe la imagen..."
sleep 15

# Estrategia: Intentar pull directamente en lugar de verificar primero con describe-images
# Docker pull es más confiable que describe-images para detectar imágenes recién subidas
PULL_SUCCESS=false
MAX_PULL_RETRIES=8
PULL_RETRY_COUNT=0

# Primero intentar con el tag original
while [ \$PULL_RETRY_COUNT -lt \$MAX_PULL_RETRIES ] && [ "\$PULL_SUCCESS" = "false" ]; do
  echo "🔄 Intento \$((PULL_RETRY_COUNT + 1)) de \$MAX_PULL_RETRIES: Intentando pull de \$TARGET_IMAGE..."
  PULL_OUTPUT=\$(docker pull "\$TARGET_IMAGE" 2>&1)
  PULL_EXIT_CODE=\$?
  
  if [ \$PULL_EXIT_CODE -eq 0 ]; then
    PULL_SUCCESS=true
    echo "✅ Imagen \$TARGET_IMAGE descargada correctamente"
    echo "\$PULL_OUTPUT" | tail -3
    break
  else
    PULL_RETRY_COUNT=\$((PULL_RETRY_COUNT + 1))
    if [ \$PULL_RETRY_COUNT -lt \$MAX_PULL_RETRIES ]; then
      echo "⚠️  Pull falló, esperando 8 segundos antes de reintentar..."
      echo "\$PULL_OUTPUT" | tail -3
      sleep 8
    fi
  fi
done

# Si el pull del tag original falló, intentar con latest
if [ "\$PULL_SUCCESS" = "false" ] && [ "\$ORIGINAL_TAG" != "latest" ]; then
  echo "🔄 El tag original falló, intentando con 'latest' como fallback..."
  LATEST_IMAGE="\${TARGET_IMAGE%:*}:latest"
  PULL_RETRY_COUNT=0
  
  while [ \$PULL_RETRY_COUNT -lt \$MAX_PULL_RETRIES ] && [ "\$PULL_SUCCESS" = "false" ]; do
    echo "🔄 Intento \$((PULL_RETRY_COUNT + 1)) de \$MAX_PULL_RETRIES: Intentando pull de \$LATEST_IMAGE..."
    PULL_OUTPUT=\$(docker pull "\$LATEST_IMAGE" 2>&1)
    PULL_EXIT_CODE=\$?
    
    if [ \$PULL_EXIT_CODE -eq 0 ]; then
      PULL_SUCCESS=true
      TARGET_IMAGE="\$LATEST_IMAGE"
      ORIGINAL_TAG="latest"
      echo "✅ Imagen :latest descargada como fallback"
      echo "\$PULL_OUTPUT" | tail -3
      break
    else
      PULL_RETRY_COUNT=\$((PULL_RETRY_COUNT + 1))
      if [ \$PULL_RETRY_COUNT -lt \$MAX_PULL_RETRIES ]; then
        echo "⚠️  Pull de latest falló, esperando 8 segundos antes de reintentar..."
        echo "\$PULL_OUTPUT" | tail -3
        sleep 8
      fi
    fi
  done
fi

# Si todo falló, mostrar información de diagnóstico y salir
if [ "\$PULL_SUCCESS" = "false" ]; then
  echo "❌ Error: No se pudo descargar ninguna imagen después de todos los intentos"
  echo "📋 Último output del pull:"
  echo "\$PULL_OUTPUT" | tail -10
  echo ""
  echo "🔍 Diagnóstico:"
  echo "   Intentando listar imágenes en ECR..."
  aws ecr describe-images --repository-name "\$REPO_NAME" --region "\$REGION" --query 'imageDetails[*].[imageTags[0],imagePushedAt]' --output table 2>/dev/null | head -15 || echo "   No se pudieron listar imágenes (puede ser un problema de permisos)"
  echo ""
  echo "   Verificando login a ECR..."
  docker images "\${FULL_REPO}" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" 2>/dev/null | head -5 || echo "   No hay imágenes locales de este repositorio"
  exit 1
fi

# Verificar que la imagen se descargó correctamente
IMAGE_ID=\$(docker images "\$TARGET_IMAGE" --format "{{.ID}}" | head -1)
if [ -z "\$IMAGE_ID" ]; then
  echo "❌ Error: La imagen \$TARGET_IMAGE no se encuentra localmente después del pull"
  echo "📋 Imágenes disponibles en el repositorio:"
  docker images "\${TARGET_IMAGE%:*}" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | head -10
  echo "📋 Todas las imágenes Docker:"
  docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | head -10
  exit 1
fi

# Obtener información de la imagen
IMAGE_CREATED=\$(docker images "\$TARGET_IMAGE" --format "{{.CreatedAt}}" | head -1)
echo "✅ Imagen descargada: \$TARGET_IMAGE"
echo "   ID: \$IMAGE_ID"
echo "   Creada: \$IMAGE_CREATED"

# Obtener configuración desde Secrets Manager
if command -v jq >/dev/null 2>&1; then
  APP_CONFIG_JSON=\$(aws secretsmanager get-secret-value --secret-id "\$APP_CONFIG_SECRET_ID" --query SecretString --output text 2>/dev/null || echo "")
  [ -n "\$APP_CONFIG_JSON" ] && [ "\$APP_CONFIG_JSON" != "None" ] && \
    while IFS= read -r line; do [ -n "\$line" ] && export "\$line"; done < <(echo "\$APP_CONFIG_JSON" | jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]' 2>/dev/null || echo "")
  
  DB_JSON=\$(aws secretsmanager get-secret-value --secret-id "\$DB_CREDENTIALS_SECRET_ID" --query SecretString --output text 2>/dev/null || echo "")
  if [ -n "\$DB_JSON" ] && [ "\$DB_JSON" != "None" ]; then
    DB_HOST=\$(echo "\$DB_JSON" | jq -r '.host // .endpoint // empty' 2>/dev/null || echo "")
    DB_PORT=\$(echo "\$DB_JSON" | jq -r '.port // "5432"' 2>/dev/null || echo "5432")
    DB_NAME=\$(echo "\$DB_JSON" | jq -r '.dbname // .database // empty' 2>/dev/null || echo "")
    DB_USER=\$(echo "\$DB_JSON" | jq -r '.username // .user // empty' 2>/dev/null || echo "")
    DB_PASS=\$(echo "\$DB_JSON" | jq -r '.password // .pass // empty' 2>/dev/null || echo "")
    [ -n "\$DB_HOST" ] && [ -n "\$DB_NAME" ] && [ -n "\$DB_USER" ] && [ -n "\$DB_PASS" ] && \
      export DATABASE_URL="postgresql://\$DB_USER:\$DB_PASS@\$DB_HOST:\$DB_PORT/\$DB_NAME?schema=public"
  fi
fi

echo "🛑 Deteniendo y eliminando contenedor antiguo..."
# Forzar detención y eliminación
docker stop "\$CONTAINER_NAME" 2>/dev/null || true
sleep 1
docker rm -f "\$CONTAINER_NAME" 2>/dev/null || true
sleep 1

# Verificar que el contenedor fue eliminado
if docker ps -a --format "{{.Names}}" | grep -q "^\$CONTAINER_NAME$"; then
  echo "⚠️  El contenedor aún existe, forzando eliminación..."
  docker rm -f "\$CONTAINER_NAME" || true
  sleep 1
fi

# Limpiar imágenes antiguas para liberar espacio (opcional, pero ayuda)
echo "🧹 Limpiando imágenes Docker antiguas (sin etiquetas)..."
docker image prune -f >/dev/null 2>&1 || true

# Construir comando docker run con variables de entorno
DOCKER_ENV_ARGS=(
  "-e" "NODE_ENV=production"
)

if [ -n "\${DATABASE_URL:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "DATABASE_URL=\$DATABASE_URL")
fi

if [ -n "\${JWT_ACCESS_SECRET:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "JWT_ACCESS_SECRET=\$JWT_ACCESS_SECRET")
fi

if [ -n "\${JWT_REFRESH_SECRET:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "JWT_REFRESH_SECRET=\$JWT_REFRESH_SECRET")
fi

if [ -n "\${AWS_REGION:-}" ]; then
  DOCKER_ENV_ARGS+=("-e" "AWS_REGION=\$AWS_REGION")
fi

echo "🚀 Creando nuevo contenedor con imagen: \$TARGET_IMAGE"
docker run -d \
  --name "\$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "\$PORT:\$PORT" \
  "\${DOCKER_ENV_ARGS[@]}" \
  "\$TARGET_IMAGE" || { 
    echo "❌ Error al crear contenedor"
    echo "📋 Verificando si la imagen existe localmente:"
    docker images "\$TARGET_IMAGE" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}"
    exit 1
  }

# Esperar un momento para que el contenedor se inicie
sleep 2

# Verificar que el contenedor está usando la imagen correcta
CONTAINER_IMAGE=\$(docker inspect "\$CONTAINER_NAME" --format "{{.Config.Image}}" 2>/dev/null || echo "")
if [ -z "\$CONTAINER_IMAGE" ]; then
  echo "❌ Error: No se pudo obtener información del contenedor"
  exit 1
fi

if [ "\$CONTAINER_IMAGE" != "\$TARGET_IMAGE" ]; then
  echo "⚠️  ADVERTENCIA: El contenedor está usando la imagen \$CONTAINER_IMAGE en lugar de \$TARGET_IMAGE"
  echo "🔄 Reintentando con la imagen correcta..."
  docker stop "\$CONTAINER_NAME" 2>/dev/null || true
  docker rm "\$CONTAINER_NAME" 2>/dev/null || true
  docker run -d \
    --name "\$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "\$PORT:\$PORT" \
    "\${DOCKER_ENV_ARGS[@]}" \
    "\$TARGET_IMAGE" || { echo "❌ Error al recrear contenedor"; exit 1; }
  sleep 2
  CONTAINER_IMAGE=\$(docker inspect "\$CONTAINER_NAME" --format "{{.Config.Image}}" 2>/dev/null || echo "")
fi

echo "✅ Contenedor actualizado correctamente"
echo "📦 Imagen configurada: \$TARGET_IMAGE"
echo "📦 Imagen en uso: \$CONTAINER_IMAGE"
echo "📊 Estado del contenedor:"
docker ps --filter name="\$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
EOF

# Codificar el script en base64 para enviarlo por SSM
SCRIPT_B64=$(base64 -w 0 /tmp/remote_update.sh 2>/dev/null || base64 /tmp/remote_update.sh | tr -d '\n')

# Construir JSON de forma segura
if command -v jq >/dev/null 2>&1; then
  PARAMS_JSON=$(jq -n --arg cmd "echo '$SCRIPT_B64' | base64 -d > /tmp/update_remote.sh && chmod +x /tmp/update_remote.sh && /tmp/update_remote.sh" '{"commands":[$cmd]}')
else
  # Fallback sin jq
  PARAMS_JSON="{\"commands\":[\"echo '$SCRIPT_B64' | base64 -d > /tmp/update_remote.sh && chmod +x /tmp/update_remote.sh && /tmp/update_remote.sh\"]}"
fi

for INSTANCE_ID in $INSTANCE_IDS; do
  echo "Actualizando $INSTANCE_ID..."
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "$PARAMS_JSON" \
    --timeout-seconds 900 \
    --query "Command.CommandId" \
    --output text 2>&1)
  
  if [ -z "$COMMAND_ID" ] || [ "$COMMAND_ID" = "None" ] || echo "$COMMAND_ID" | grep -q "Error"; then
    echo "❌ Error enviando comando SSM: $COMMAND_ID"
    continue
  fi
  
  WAIT_COUNT=0
  while [ $WAIT_COUNT -lt 12 ]; do
    sleep 10
    STATUS=$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'Status' --output text 2>/dev/null || echo "Pending")
    
    if [ "$STATUS" = "Success" ]; then
      echo "✅ $INSTANCE_ID actualizada"
      echo "📋 Salida del deployment:"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null | tail -20
      break
    elif [ "$STATUS" = "Failed" ]; then
      echo "❌ $INSTANCE_ID falló"
      echo "📋 Salida de error:"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null
      echo "📋 Salida estándar:"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null | tail -20
      break
    elif [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "TimedOut" ]; then
      echo "⚠️  $INSTANCE_ID: $STATUS"
      break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
done

echo "Deployment completado"

