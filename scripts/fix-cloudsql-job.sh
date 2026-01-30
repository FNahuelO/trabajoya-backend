#!/bin/bash
# Script rápido para actualizar el job de seed con la conexión Cloud SQL

PROJECT_ID="trabajo-ya-483316"
REGION="us-central1"
CLOUD_SQL_INSTANCE="${PROJECT_ID}:us-central1:trabajoya-db"
JOB_NAME="trabajoya-seed"

echo "🔧 Actualizando job ${JOB_NAME} con conexión Cloud SQL..."

# Actualizar el job con Cloud SQL
gcloud run jobs update ${JOB_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --add-cloudsql-instances=${CLOUD_SQL_INSTANCE}

echo "✅ Job actualizado. Verificando configuración..."

# Verificar que la conexión esté configurada
gcloud run jobs describe ${JOB_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='CLOUD_SQL_CONNECTION_NAME')].value)"

echo ""
echo "🚀 Para ejecutar el job ahora:"
echo "   gcloud run jobs execute ${JOB_NAME} --project=${PROJECT_ID} --region=${REGION} --wait"



















