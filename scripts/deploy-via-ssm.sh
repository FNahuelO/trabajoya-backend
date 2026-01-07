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
docker pull "\$TARGET_IMAGE" || {
  echo "⚠️  No se pudo descargar \$TARGET_IMAGE, intentando con :latest"
  docker pull "\${TARGET_IMAGE%:*}:latest" || { echo "❌ No se pudo descargar imagen"; exit 1; }
  TARGET_IMAGE="\${TARGET_IMAGE%:*}:latest"
}

# Verificar que la imagen se descargó correctamente
IMAGE_ID=\$(docker images "\$TARGET_IMAGE" --format "{{.ID}}" | head -1)
if [ -z "\$IMAGE_ID" ]; then
  echo "❌ Error: La imagen \$TARGET_IMAGE no se encuentra localmente"
  exit 1
fi

echo "✅ Imagen descargada: \$TARGET_IMAGE (ID: \$IMAGE_ID)"

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

docker stop "\$CONTAINER_NAME" 2>/dev/null || true
docker rm "\$CONTAINER_NAME" 2>/dev/null || true

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

docker run -d \
  --name "\$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "\$PORT:\$PORT" \
  "\${DOCKER_ENV_ARGS[@]}" \
  "\$TARGET_IMAGE" || { echo "❌ Error al crear contenedor"; exit 1; }

# Verificar que el contenedor está usando la imagen correcta
CONTAINER_IMAGE=\$(docker inspect "\$CONTAINER_NAME" --format "{{.Config.Image}}" 2>/dev/null || echo "")
if [ "\$CONTAINER_IMAGE" != "\$TARGET_IMAGE" ]; then
  echo "⚠️  Advertencia: El contenedor está usando la imagen \$CONTAINER_IMAGE en lugar de \$TARGET_IMAGE"
fi

echo "✅ Contenedor actualizado"
echo "📦 Imagen usada: \$CONTAINER_IMAGE"
docker ps --filter name="\$CONTAINER_NAME" --format "{{.Names}} - {{.Status}} - {{.Image}}"
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
      break
    elif [ "$STATUS" = "Failed" ]; then
      echo "❌ $INSTANCE_ID falló"
      aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --query 'StandardErrorContent' --output text 2>/dev/null | head -5
      break
    elif [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "TimedOut" ]; then
      echo "⚠️  $INSTANCE_ID: $STATUS"
      break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
done

echo "Deployment completado"
