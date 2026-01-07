#!/bin/bash
set -euo pipefail

TARGET_IMAGE="${REPOSITORY_URI}:${IMAGE_TAG}"
CONTAINER_NAME="${PROJECT_NAME}-backend"
DEPLOY_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "Imagen objetivo: $TARGET_IMAGE"
echo "Region: $DEPLOY_REGION"

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

read -r -d '' REMOTE_CMD <<'EOF'
set -euo pipefail

# Instalar jq si no existe
if ! command -v jq >/dev/null 2>&1; then
  echo "Instalando jq..."
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y jq
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y jq
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y jq
  else
    echo "No se pudo determinar el gestor de paquetes para instalar jq"
    exit 1
  fi
fi

REGION="$DEPLOY_REGION"
TARGET_IMAGE="$TARGET_IMAGE"
CONTAINER_NAME="$CONTAINER_NAME"
APP_CONFIG_SECRET_ID="$APP_CONFIG_SECRET_ID"
DB_CREDENTIALS_SECRET_ID="$DB_CREDENTIALS_SECRET_ID"
PORT="$CONTAINER_PORT"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

docker pull $TARGET_IMAGE

APP_CONFIG_JSON=$(aws secretsmanager get-secret-value --secret-id $APP_CONFIG_SECRET_ID --query SecretString --output text)
DB_JSON=$(aws secretsmanager get-secret-value --secret-id $DB_CREDENTIALS_SECRET_ID --query SecretString --output text)

while IFS== read -r k v; do export "$k"="$v"; done < <(echo "$APP_CONFIG_JSON" | jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]')

DB_HOST=$(echo "$DB_JSON" | jq -r '.host')
DB_PORT=$(echo "$DB_JSON" | jq -r '.port')
DB_NAME=$(echo "$DB_JSON" | jq -r '.dbname')
DB_USER=$(echo "$DB_JSON" | jq -r '.username')
DB_PASS=$(echo "$DB_JSON" | jq -r '.password')

export DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME

docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

docker run -d --name $CONTAINER_NAME --restart unless-stopped -p $PORT:$PORT \
  -e NODE_ENV=production \
  -e DATABASE_URL="$DATABASE_URL" \
  -e JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-}" \
  $TARGET_IMAGE

docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker logs --tail 50 $CONTAINER_NAME || true
EOF

PARAMS_JSON=$(jq -n --arg c "$REMOTE_CMD" '{commands: [$c]}')

for INSTANCE_ID in $INSTANCE_IDS; do
  echo "Enviando a $INSTANCE_ID"
  COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "$PARAMS_JSON" \
    --timeout-seconds 900 \
    --query "Command.CommandId" \
    --output text)
  echo "SSM CommandId: $COMMAND_ID"
done

echo "Deploy enviado."
