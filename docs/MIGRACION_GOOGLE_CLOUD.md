# Guía de Migración a Google Cloud Platform

Esta guía documenta la migración del backend de TrabajoYa a Google Cloud Platform, con prioridad en mantener funcionando perfectamente los sistemas de mensajes y llamadas que utilizan WebSockets.

## 📋 Tabla de Contenidos

1. [Componentes Migrados](#componentes-migrados)
2. [Servicios de Google Cloud Utilizados](#servicios-de-google-cloud-utilizados)
3. [Configuración Inicial](#configuración-inicial)
4. [Migración de Base de Datos](#migración-de-base-de-datos)
5. [Migración de Almacenamiento](#migración-de-almacenamiento)
6. [Despliegue en Cloud Run](#despliegue-en-cloud-run)
7. [Configuración de WebSockets](#configuración-de-websockets)
8. [Variables de Entorno](#variables-de-entorno)
9. [CI/CD con Cloud Build](#cicd-con-cloud-build)
10. [Verificación y Testing](#verificación-y-testing)

## Componentes Migrados

### ✅ Servicios Migrados
- **Backend API (NestJS)**: Migrado a Cloud Run
- **Base de Datos PostgreSQL**: Migrado a Cloud SQL
- **Almacenamiento de Archivos**: Migrado de S3 a Cloud Storage
- **CDN**: Migrado de CloudFront a Cloud CDN
- **Mensajes en Tiempo Real**: WebSockets funcionando en Cloud Run
- **Llamadas en Tiempo Real**: WebRTC funcionando en Cloud Run

### ⚠️ Servicios Pendientes de Migración
- **Servicio de Email**: Actualmente usa AWS SES (recomendación: usar SendGrid o Resend)
- **Notificaciones Push**: Ya usa Expo Push (sin cambios necesarios)

## Servicios de Google Cloud Utilizados

1. **Cloud Run**: Contenedorización y ejecución del backend
   - Soporte nativo para WebSockets
   - Escalado automático
   - HTTPS y balanceo de carga incluido

2. **Cloud SQL (PostgreSQL)**: Base de datos gestionada
   - Respaldos automáticos
   - Alta disponibilidad opcional
   - Conexión privada desde Cloud Run

3. **Cloud Storage**: Almacenamiento de archivos
   - Reemplazo de S3
   - Integración con Cloud CDN
   - URLs firmadas para uploads

4. **Cloud CDN**: Distribución de contenido
   - Reemplazo de CloudFront
   - Cacheo de archivos estáticos
   - URLs públicas optimizadas

5. **Cloud Build**: CI/CD automatizado
   - Build y deploy automático
   - Integración con GitHub/GitLab

6. **Secret Manager**: Gestión de secretos
   - Reemplazo de AWS Secrets Manager
   - Integración con Cloud Run

## Configuración Inicial

### 1. Instalar Google Cloud SDK

```bash
# En macOS
brew install google-cloud-sdk

# En Linux
curl https://sdk.cloud.google.com | bash

# Verificar instalación
gcloud --version
```

### 2. Autenticarse en Google Cloud

```bash
gcloud auth login
gcloud config set project TU_PROJECT_ID
```

### 3. Habilitar APIs Necesarias

```bash
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  storage-component.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com
```

## Migración de Base de Datos

### 1. Crear Instancia de Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create trabajoya-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --authorized-networks=0.0.0.0/0  # Ajustar según necesidad de seguridad
```

### 2. Crear Base de Datos

```bash
gcloud sql databases create trabajoya --instance=trabajoya-db
```

### 3. Crear Usuario de Base de Datos

```bash
gcloud sql users create trabajoya-user \
  --instance=trabajoya-db \
  --password=TU_PASSWORD_SEGURO
```

### 4. Migrar Datos desde AWS RDS

```bash
# Exportar desde RDS
pg_dump -h AWS_RDS_ENDPOINT -U usuario -d trabajoya > backup.sql

# Importar a Cloud SQL
gcloud sql import sql trabajoya-db gs://BUCKET_NAME/backup.sql \
  --database=trabajoya
```

### 5. Guardar Connection String en Secret Manager

```bash
# Obtener IP de la instancia
gcloud sql instances describe trabajoya-db --format="value(ipAddresses[0].ipAddress)"

# Crear secret con DATABASE_URL
echo "postgresql://trabajoya-user:PASSWORD@IP:5432/trabajoya?schema=public" | \
  gcloud secrets create DATABASE_URL --data-file=-
```

## Migración de Almacenamiento

### 1. Crear Bucket de Cloud Storage

```bash
gsutil mb -p TU_PROJECT_ID -l us-central1 gs://trabajoya-storage
```

### 2. Configurar Permisos del Bucket

```bash
# Hacer bucket público para lectura (opcional, usar URLs firmadas si es preferible)
gsutil iam ch allUsers:objectViewer gs://trabajoya-storage

# O configurar permisos más restrictivos con Cloud IAM
gsutil iam ch serviceAccount:TU_SERVICE_ACCOUNT:objectAdmin gs://trabajoya-storage
```

### 3. Migrar Archivos desde S3

```bash
# Usar AWS CLI para listar y migrar archivos
aws s3 ls s3://BUCKET_ANTERIOR/ --recursive | while read -r line; do
  # Extraer key y migrar
  aws s3 cp s3://BUCKET_ANTERIOR/$key gs://trabajoya-storage/$key
done
```

### 4. Guardar Nombre del Bucket en Secret Manager

```bash
echo "trabajoya-storage" | gcloud secrets create GCS_BUCKET_NAME --data-file=-
```

## Despliegue en Cloud Run

### 1. Configurar Cloud Build

El archivo `cloudbuild.yaml` ya está configurado. Verifica las variables:

```yaml
_REGION: 'us-central1'
_MEMORY: '2Gi'
_CPU: '2'
_MIN_INSTANCES: '1'  # Importante para WebSockets
_MAX_INSTANCES: '10'
_CONCURRENCY: '80'
```

### 2. Desplegar Manualmente (Primera Vez)

```bash
# Construir imagen
gcloud builds submit --config cloudbuild.yaml

# O desplegar directamente
gcloud run deploy trabajoya-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 300 \
  --port 8080 \
  --set-env-vars NODE_ENV=production
```

### 3. Configurar Variables de Entorno

```bash
gcloud run services update trabajoya-backend \
  --region us-central1 \
  --update-secrets DATABASE_URL=DATABASE_URL:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,GCS_BUCKET_NAME=GCS_BUCKET_NAME:latest
```

## Configuración de WebSockets

### Importante: WebSockets en Cloud Run

Cloud Run **soporta WebSockets nativamente** desde 2021. Sin embargo, hay configuraciones importantes:

1. **Min Instances = 1**: Necesario para mantener conexiones WebSocket activas
   ```bash
   gcloud run services update trabajoya-backend \
     --min-instances 1
   ```

2. **Timeout**: Aumentar a 300 segundos (máximo)
   ```bash
   gcloud run services update trabajoya-backend \
     --timeout 300
   ```

3. **Memory y CPU**: Suficiente para manejar múltiples conexiones
   ```bash
   gcloud run services update trabajoya-backend \
     --memory 2Gi \
     --cpu 2
   ```

4. **Verificar Conexiones**: Los gateways de Socket.IO ya están configurados correctamente

### Testing de WebSockets

```javascript
// Test de conexión a mensajes
const socket = io('https://TU-URL.run.app/messages', {
  auth: { token: 'TU_JWT_TOKEN' }
});

socket.on('connected', () => {
  console.log('✅ Conectado al servicio de mensajes');
});

// Test de conexión a llamadas
const callsSocket = io('https://TU-URL.run.app/calls', {
  auth: { token: 'TU_JWT_TOKEN' }
});

callsSocket.on('connected', () => {
  console.log('✅ Conectado al servicio de llamadas');
});
```

## Variables de Entorno

### Secrets en Secret Manager

Crear los siguientes secrets:

```bash
# Base de datos
gcloud secrets create DATABASE_URL --data-file=- <<< "postgresql://user:pass@ip:5432/db"

# JWT
gcloud secrets create JWT_ACCESS_SECRET --data-file=- <<< "tu-secret"
gcloud secrets create JWT_REFRESH_SECRET --data-file=- <<< "tu-secret"

# Google Cloud Storage
gcloud secrets create GCS_BUCKET_NAME --data-file=- <<< "trabajoya-storage"
gcloud secrets create GCP_PROJECT_ID --data-file=- <<< "tu-project-id"

# OAuth
gcloud secrets create GOOGLE_CLIENT_ID --data-file=- <<< "tu-client-id"
gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- <<< "tu-client-secret"

# OpenAI
gcloud secrets create OPENAI_API_KEY --data-file=- <<< "tu-api-key"
```

### Variables de Entorno en Cloud Run

Configurar variables no sensibles:

```bash
gcloud run services update trabajoya-backend \
  --update-env-vars \
    NODE_ENV=production,\
    PORT=8080,\
    ALLOWED_ORIGINS=https://tu-frontend.com
```

## CI/CD con Cloud Build

### 1. Conectar Repositorio

```bash
# Conectar GitHub
gcloud source repos create trabajoya-backend
gcloud source repos clone trabajoya-backend

# O configurar trigger desde GitHub
gcloud builds triggers create github \
  --repo-name=trabajoya-backend \
  --branch-pattern="^main$" \
  --build-config=Backend/cloudbuild.yaml
```

### 2. Configurar Cloud Build Trigger

El archivo `cloudbuild.yaml` está listo. Solo necesitas:

1. Crear trigger en la consola de GCP
2. Conectar con tu repositorio
3. Especificar ruta: `Backend/cloudbuild.yaml`

### 3. Deploy Automático

Con cada push a `main`, Cloud Build:
1. Construye la imagen Docker
2. La sube a Container Registry
3. Despliega en Cloud Run

## Verificación y Testing

### 1. Verificar Salud del Servicio

```bash
# Obtener URL del servicio
gcloud run services describe trabajoya-backend \
  --region us-central1 \
  --format="value(status.url)"

# Test de salud
curl https://TU-URL.run.app/health
```

### 2. Verificar Base de Datos

```bash
# Conectar a Cloud SQL
gcloud sql connect trabajoya-db --user=trabajoya-user --database=trabajoya
```

### 3. Verificar Almacenamiento

```bash
# Listar archivos en bucket
gsutil ls gs://trabajoya-storage/

# Probar upload
echo "test" > test.txt
gsutil cp test.txt gs://trabajoya-storage/test.txt
```

### 4. Test de Mensajes y Llamadas

Usar las herramientas de testing del frontend o Postman/Insomnia para verificar:

- ✅ Conexión WebSocket a `/messages`
- ✅ Envío y recepción de mensajes
- ✅ Conexión WebSocket a `/calls`
- ✅ Inicio y aceptación de llamadas
- ✅ WebRTC funcionando correctamente

## Actualización del Código

### Cambios Necesarios en el Código

1. **Upload Service**: Actualizar para usar `GCSUploadService` en lugar de `S3UploadService`
2. **Config Service**: Actualizar para usar Secret Manager en lugar de AWS Secrets Manager
3. **Main.ts**: Ya configurado para escuchar en `0.0.0.0` y usar `PORT`

### Próximos Pasos

1. Actualizar `upload.service.ts` para detectar y usar GCS cuando esté configurado
2. Actualizar `config.module.ts` para cargar secrets de Secret Manager
3. Actualizar documentación de variables de entorno

## Troubleshooting

### WebSockets No Funcionan

- Verificar que `min-instances=1` está configurado
- Verificar que el timeout es 300 segundos
- Verificar logs: `gcloud run services logs read trabajoya-backend`

### Errores de Conexión a Base de Datos

- Verificar que Cloud Run tiene acceso a Cloud SQL
- Verificar que la IP de Cloud SQL está permitida
- Verificar que el secret `DATABASE_URL` está correcto

### Errores de Almacenamiento

- Verificar permisos del Service Account
- Verificar que el bucket existe
- Verificar que el secret `GCS_BUCKET_NAME` está correcto

## Soporte

Para problemas o preguntas:
- Revisar logs: `gcloud run services logs read trabajoya-backend`
- Documentación oficial: https://cloud.google.com/run/docs
- WebSockets en Cloud Run: https://cloud.google.com/run/docs/triggering/websockets

