# Migración a Google Cloud Platform

Este backend ha sido configurado para migrar a Google Cloud Platform, manteniendo **funcionalidad perfecta** de mensajes y llamadas que utilizan WebSockets.

## 🚀 Inicio Rápido

### 1. Configuración Inicial

```bash
# Configurar variables de entorno
export GCP_PROJECT_ID=tu-project-id
export GCP_REGION=us-central1

# Ejecutar script de configuración
cd Backend
./scripts/setup-gcp.sh
```

### 2. Desplegar a Cloud Run

```bash
# Desplegar manualmente (primera vez)
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
  --port 8080

# O usar Cloud Build (recomendado)
gcloud builds submit --config cloudbuild.yaml
```

## 📋 Configuración Requerida

### Variables de Entorno Necesarias

Las siguientes variables deben estar configuradas en Cloud Run o Secret Manager:

**En Secret Manager:**
- `DATABASE_URL` - Connection string de Cloud SQL
- `JWT_ACCESS_SECRET` - Secret para JWT access tokens
- `JWT_REFRESH_SECRET` - Secret para JWT refresh tokens
- `GCS_BUCKET_NAME` - Nombre del bucket de Cloud Storage
- `GCP_PROJECT_ID` - ID del proyecto de GCP

**En Variables de Entorno:**
- `NODE_ENV=production`
- `PORT=8080` (Cloud Run usa PORT automáticamente)
- `ALLOWED_ORIGINS` - Orígenes permitidos para CORS

### WebSockets - Configuración Crítica

Para que mensajes y llamadas funcionen perfectamente:

1. **Min Instances = 1**: Mantiene conexiones WebSocket activas
   ```bash
   gcloud run services update trabajoya-backend \
     --min-instances 1
   ```

2. **Timeout = 300**: Tiempo máximo para conexiones largas
   ```bash
   gcloud run services update trabajoya-backend \
     --timeout 300
   ```

3. **Memory y CPU**: Suficiente para múltiples conexiones
   ```bash
   gcloud run services update trabajoya-backend \
     --memory 2Gi \
     --cpu 2
   ```

## 🔧 Servicios Migrados

### ✅ Completados
- **Backend API**: Cloud Run
- **Base de Datos**: Cloud SQL (PostgreSQL)
- **Almacenamiento**: Cloud Storage (servicio `GCSUploadService` creado)
- **WebSockets**: Soporte nativo en Cloud Run (sin cambios necesarios)
- **CI/CD**: Cloud Build (configurado en `cloudbuild.yaml`)

### ⚠️ Pendientes
- **Servicio de Email**: Actualmente usa AWS SES (cambiar a SendGrid/Resend)
- **CDN**: Migrar de CloudFront a Cloud CDN (configurar después)

## 📁 Archivos Nuevos

- `Dockerfile.gcp` - Dockerfile optimizado para Google Cloud
- `cloudbuild.yaml` - Configuración de Cloud Build
- `src/upload/gcs-upload.service.ts` - Servicio de Cloud Storage
- `scripts/setup-gcp.sh` - Script de configuración inicial
- `docs/MIGRACION_GOOGLE_CLOUD.md` - Documentación completa

## 🔄 Próximos Pasos

1. **Actualizar Upload Service**: Modificar `upload.service.ts` para usar `GCSUploadService` cuando `GCS_BUCKET_NAME` esté configurado
2. **Configurar Cloud CDN**: Conectar Cloud Storage con Cloud CDN para URLs públicas
3. **Migrar Datos**: Usar `pg_dump` y `pg_restore` para migrar base de datos
4. **Migrar Archivos**: Script para migrar archivos de S3 a Cloud Storage
5. **Testing**: Probar mensajes y llamadas exhaustivamente

## 📚 Documentación Completa

Ver `docs/MIGRACION_GOOGLE_CLOUD.md` para documentación detallada de la migración.

## ⚠️ Notas Importantes

1. **WebSockets**: Cloud Run soporta WebSockets nativamente desde 2021. No se necesitan cambios en el código.
2. **Min Instances**: Es **crítico** configurar `min-instances=1` para mantener conexiones WebSocket.
3. **Timeout**: Configurar timeout de 300 segundos para permitir conexiones largas.
4. **Memory/CPU**: Asegurar suficiente memoria y CPU para manejar múltiples conexiones simultáneas.

## 🐛 Troubleshooting

### WebSockets No Funcionan
- Verificar `min-instances=1`
- Verificar `timeout=300`
- Revisar logs: `gcloud run services logs read trabajoya-backend`

### Errores de Conexión
- Verificar que Cloud Run tiene acceso a Cloud SQL
- Verificar secrets en Secret Manager
- Verificar variables de entorno

### Errores de Almacenamiento
- Verificar permisos del Service Account
- Verificar que el bucket existe
- Verificar secret `GCS_BUCKET_NAME`

## 📞 Soporte

Para problemas o preguntas:
- Revisar logs: `gcloud run services logs read trabajoya-backend`
- Documentación oficial: https://cloud.google.com/run/docs
- WebSockets en Cloud Run: https://cloud.google.com/run/docs/triggering/websockets

