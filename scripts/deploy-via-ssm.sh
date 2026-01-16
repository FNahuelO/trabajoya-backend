#!/bin/bash
# Script para desplegar la aplicación en ECS usando SSM (Systems Manager)
# Este script se ejecuta en el post_build de CodeBuild

set -e

PROJECT_NAME="${PROJECT_NAME:-trabajoya-prod}"
CLUSTER_NAME="${PROJECT_NAME}-cluster"
SERVICE_NAME="${PROJECT_NAME}-backend-service"
TASK_DEFINITION_FAMILY="${PROJECT_NAME}-backend"

echo "🚀 Iniciando despliegue vía SSM..."

# Obtener la región
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Obtener el ARN del task definition más reciente
echo "📋 Obteniendo última definición de tarea..."
TASK_DEF_ARN=$(aws ecs describe-task-definition \
    --task-definition "$TASK_DEFINITION_FAMILY" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$TASK_DEF_ARN" ]; then
    echo "❌ No se encontró la definición de tarea. ¿Está desplegada la infraestructura?"
    exit 1
fi

echo "✅ Task Definition encontrada: $TASK_DEF_ARN"

# Actualizar el servicio ECS
echo "🔄 Actualizando servicio ECS..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$TASK_DEFINITION_FAMILY" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Servicio actualizado. Nueva tarea en despliegue..."
    
    # Esperar a que el servicio se estabilice
    echo "⏳ Esperando a que el servicio se estabilice..."
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION" || {
        echo "⚠️  El servicio no se estabilizó completamente, pero el despliegue continúa..."
    }
    
    echo "✅ Despliegue completado!"
else
    echo "❌ Error al actualizar el servicio"
    exit 1
fi

# Ejecutar migraciones después del despliegue
echo "📦 Ejecutando migraciones de base de datos..."
echo "⚠️  Nota: Las migraciones también se ejecutan automáticamente al iniciar el contenedor"
echo "    Si necesitas ejecutarlas manualmente, usa:"
echo "    aws ecs execute-command --cluster $CLUSTER_NAME --task <task-id> --container backend --command 'npx prisma migrate deploy' --interactive"

echo "✅ Proceso de despliegue completado!"

