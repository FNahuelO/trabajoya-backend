#!/bin/bash

# Script para configurar Google Cloud Platform para TrabajoYa Backend
# Este script automatiza la configuración inicial de GCP

set -e

PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
DB_NAME="trabajoya"
DB_USER="trabajoya-user"
DB_INSTANCE="trabajoya-db"
STORAGE_BUCKET="trabajoya-storage"
SERVICE_NAME="trabajoya-backend"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo_error "gcloud CLI no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar que PROJECT_ID está configurado
if [ -z "$PROJECT_ID" ]; then
    echo_error "GCP_PROJECT_ID no está configurado. Por favor configúralo:"
    echo "export GCP_PROJECT_ID=tu-project-id"
    exit 1
fi

echo_info "Configurando GCP para TrabajoYa Backend"
echo_info "Project ID: $PROJECT_ID"
echo_info "Region: $REGION"

# Configurar proyecto
gcloud config set project "$PROJECT_ID"

# Habilitar APIs necesarias
echo_info "Habilitando APIs necesarias..."
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  storage-component.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com

# Crear Cloud SQL instance
echo_info "Creando instancia de Cloud SQL..."
if ! gcloud sql instances describe "$DB_INSTANCE" &> /dev/null; then
    gcloud sql instances create "$DB_INSTANCE" \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region="$REGION" \
      --storage-type=SSD \
      --storage-size=20GB \
      --storage-auto-increase \
      --backup-start-time=03:00 \
      --enable-bin-log
else
    echo_warn "La instancia $DB_INSTANCE ya existe"
fi

# Crear base de datos
echo_info "Creando base de datos..."
if ! gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" &> /dev/null; then
    gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
else
    echo_warn "La base de datos $DB_NAME ya existe"
fi

# Crear usuario de base de datos
echo_info "Creando usuario de base de datos..."
read -sp "Ingresa la contraseña para el usuario $DB_USER: " DB_PASSWORD
echo

# Obtener IP de la instancia
DB_IP=$(gcloud sql instances describe "$DB_INSTANCE" --format="value(ipAddresses[0].ipAddress)")
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_IP:5432/$DB_NAME?schema=public"

# Crear bucket de Cloud Storage
echo_info "Creando bucket de Cloud Storage..."
if ! gsutil ls -b gs://"$STORAGE_BUCKET" &> /dev/null; then
    gsutil mb -p "$PROJECT_ID" -l "$REGION" gs://"$STORAGE_BUCKET"
    echo_info "Bucket $STORAGE_BUCKET creado"
else
    echo_warn "El bucket $STORAGE_BUCKET ya existe"
fi

# Crear secrets en Secret Manager
echo_info "Creando secrets en Secret Manager..."

echo "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=- 2>/dev/null || \
  echo "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL --data-file=-

# Crear secret para JWT (pedir al usuario)
read -sp "Ingresa JWT_ACCESS_SECRET: " JWT_ACCESS_SECRET
echo
echo "$JWT_ACCESS_SECRET" | gcloud secrets create JWT_ACCESS_SECRET --data-file=- 2>/dev/null || \
  echo "$JWT_ACCESS_SECRET" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=-

read -sp "Ingresa JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET
echo
echo "$JWT_REFRESH_SECRET" | gcloud secrets create JWT_REFRESH_SECRET --data-file=- 2>/dev/null || \
  echo "$JWT_REFRESH_SECRET" | gcloud secrets versions add JWT_REFRESH_SECRET --data-file=-

# Crear secret para bucket name
echo "$STORAGE_BUCKET" | gcloud secrets create GCS_BUCKET_NAME --data-file=- 2>/dev/null || \
  echo "$STORAGE_BUCKET" | gcloud secrets versions add GCS_BUCKET_NAME --data-file=-

# Crear secret para project ID
echo "$PROJECT_ID" | gcloud secrets create GCP_PROJECT_ID --data-file=- 2>/dev/null || \
  echo "$PROJECT_ID" | gcloud secrets versions add GCP_PROJECT_ID --data-file=-

echo_info "✅ Configuración inicial completada!"
echo_info ""
echo_info "Próximos pasos:"
echo_info "1. Ejecutar migraciones de Prisma: npm run prisma:deploy"
echo_info "2. Desplegar a Cloud Run: gcloud run deploy"
echo_info ""
echo_info "Database URL guardada en Secret Manager: DATABASE_URL"
echo_info "Storage Bucket: gs://$STORAGE_BUCKET"

