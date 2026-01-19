# Eliminación de AWS y Render

Este documento describe los cambios realizados para eliminar dependencias de AWS y Render, migrando a Google Cloud Platform.

## Cambios Realizados

### 1. Config Module (`src/config/config.module.ts`)
- ✅ Eliminado `AwsConfigService` del módulo
- ✅ Ahora solo usa `GcpConfigService`
- Los secrets ahora se cargan solo desde Google Cloud Secret Manager

### 2. Upload Module (`src/upload/upload.module.ts`)
- ✅ Eliminado `CloudFrontSignerService` del módulo
- ✅ Mantenido `S3UploadService` como fallback (para migración de datos)
- ✅ Mantenido `GCSUploadService` (principal)

### 3. Dependencias de AWS (`package.json`)
- ❌ Eliminado `@aws-sdk/client-cloudfront`
- ❌ Eliminado `@aws-sdk/client-secrets-manager`
- ❌ Eliminado `@aws-sdk/client-sesv2`
- ❌ Eliminado `@aws-sdk/client-ssm`
- ✅ Mantenido `@aws-sdk/client-s3` (temporal, para migración)
- ✅ Mantenido `@aws-sdk/s3-request-presigner` (temporal, para migración)

### 4. Servicios Actualizados

#### Messages Service
- ✅ Eliminada inyección de `CloudFrontSignerService`
- ✅ Removidas referencias a CloudFront
- ✅ Ahora usa directamente `S3UploadService` o `GCSUploadService` (detectado automáticamente)

## Archivos Pendientes de Actualización

Los siguientes archivos todavía tienen referencias a `CloudFrontSignerService` que deben ser eliminadas o comentadas:

1. `src/postulantes/postulantes.service.ts`
2. `src/terms/terms.service.ts`
3. `src/jobs/jobs.service.ts`
4. `src/empresas/empresas.service.ts`
5. `src/favorites/favorites.service.ts`
6. `src/media/media.service.ts`

### Patrón a Reemplazar

**Antes:**
```typescript
if (this.cloudFrontSigner.isCloudFrontConfigured()) {
  const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(path);
  // usar cloudFrontUrl
} else {
  // usar s3UploadService
}
```

**Después:**
```typescript
// CloudFront eliminado - usando S3/GCS directamente
const url = await this.s3UploadService.getObjectUrl(path, 3600);
```

Nota: `s3UploadService` detecta automáticamente si usar S3 o GCS basado en la variable de entorno `GCS_BUCKET_NAME`.

## Archivos Mantenidos (No Eliminados)

Estos archivos se mantienen para referencia pero no se usan activamente:

- `src/config/aws-config.service.ts` - Comentado, no se usa si `GCP_PROJECT_ID` está configurado
- `src/upload/cloudfront-signer.service.ts` - Comentado, removido del módulo
- `src/upload/s3-upload.service.ts` - Mantenido como fallback (para migración de datos)

## Próximos Pasos

1. Actualizar los servicios pendientes para eliminar referencias a CloudFront
2. Eliminar completamente `@aws-sdk/client-s3` una vez migrados todos los datos
3. Eliminar archivos de AWS (`aws-config.service.ts`, `cloudfront-signer.service.ts`) cuando ya no se necesiten

## Notas

- La migración es gradual: el código puede usar S3 o GCS según configuración
- `GCS_BUCKET_NAME` determina qué servicio usar
- Si `GCS_BUCKET_NAME` está configurado → usa GCS
- Si no está configurado → usa S3 (fallback para compatibilidad)

