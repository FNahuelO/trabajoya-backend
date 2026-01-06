# Resumen de Preparación para AWS - TrabajoYa Backend

Este documento resume todos los cambios realizados para preparar el backend para el deployment en AWS.

## ✅ Cambios Realizados

### 1. Módulo de Configuración AWS (`src/config/aws-config.service.ts`)

**Nuevo servicio creado** que carga automáticamente la configuración desde AWS en producción:

- **Secrets Manager**: Carga secretos de la aplicación y base de datos
- **SSM Parameter Store**: Carga parámetros de configuración (S3, CloudFront, etc.)
- **Auto-inicialización**: Se ejecuta automáticamente al iniciar el módulo (`OnModuleInit`)
- **Solo en producción**: Solo carga desde AWS cuando `NODE_ENV=production`

**Variables cargadas desde Secrets Manager:**
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `MAIL_FROM`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_REDIRECT_URI`
- `OPENAI_API_KEY`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`

**Variables cargadas desde SSM Parameter Store:**
- `S3_BUCKET_NAME` (desde `/{stackPrefix}/s3/bucket`)
- `CLOUDFRONT_DOMAIN` (desde `/{stackPrefix}/cloudfront/domain`)
- `CLOUDFRONT_DISTRIBUTION_ID` (desde `/{stackPrefix}/cloudfront/distribution-id`)
- `CLOUDFRONT_KEY_PAIR_ID` (desde `/{stackPrefix}/cloudfront/keypair-id`)

**Variables construidas desde Secrets Manager (Base de Datos):**
- `DATABASE_URL` (construida desde credenciales de RDS)

### 2. Actualización de `.env.example`

**Archivo actualizado** con todas las variables necesarias para AWS:

- Variables organizadas por sección (Database, JWT, AWS, Email, OAuth, etc.)
- Documentación de qué variables se cargan automáticamente desde AWS
- Ejemplos de valores para desarrollo local
- Comentarios explicativos para cada sección

### 3. Mejoras en `Dockerfile.aws`

**Mejoras realizadas:**

- Script de entrypoint mejorado con mejor logging
- Mensajes informativos durante el inicio
- Manejo de errores mejorado para migraciones

### 4. Corrección de Variables JWT

**Cambios en `src/auth/auth.service.ts`:**

- Uso correcto de `JWT_ACCESS_EXPIRES_IN` (en lugar de `JWT_ACCESS_TTL`)
- Uso correcto de `JWT_REFRESH_EXPIRES_IN` (en lugar de `JWT_REFRESH_TTL`)
- Soporte para formatos de tiempo como "15m", "7d", etc.
- Conversión automática a milisegundos

### 5. Actualización de Infraestructura CDK

**Cambios en `infra/lib/ec2-autoscaling.ts`:**

- User-data actualizado para pasar todas las variables necesarias al contenedor
- Variables adicionales agregadas:
  - `DATABASE_SECRET_ARN`
  - `DATABASE_ENDPOINT`
  - `DATABASE_NAME`
  - `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`
  - `APP_SECRETS_ARN`
  - `STACK_PREFIX`
  - `MAIL_PROVIDER=ses`
  - `MAIL_FROM`
  - `SWAGGER_ENABLED=false`

### 6. Integración del Módulo de Configuración

**Cambios en `src/config/config.module.ts`:**

- `AwsConfigService` agregado como provider
- Exportado para uso en otros módulos

**Cambios en `src/app.module.ts`:**

- Actualizado para usar el `ConfigModule` local en lugar del de NestJS directamente

### 7. Documentación

**Archivos creados:**

- **`AWS_DEPLOYMENT_CHECKLIST.md`**: Checklist completo para deployment
  - Variables de entorno requeridas
  - Configuración de AWS
  - Testing post-deployment
  - Troubleshooting
  - Comandos útiles

## 🔧 Configuración Requerida en AWS

### Secrets Manager

#### `/trabajoya-prod/app/config`
```json
{
  "JWT_ACCESS_SECRET": "tu-secret-super-seguro",
  "JWT_REFRESH_SECRET": "tu-refresh-secret",
  "JWT_ACCESS_EXPIRES_IN": "15m",
  "JWT_REFRESH_EXPIRES_IN": "7d",
  "MAIL_FROM": "noreply@trabajoya.com",
  "GOOGLE_CLIENT_ID": "...",
  "GOOGLE_CLIENT_SECRET": "...",
  "APPLE_CLIENT_ID": "...",
  "APPLE_REDIRECT_URI": "...",
  "OPENAI_API_KEY": "...",
  "PAYPAL_CLIENT_ID": "...",
  "PAYPAL_CLIENT_SECRET": "..."
}
```

#### `/{stackPrefix}/database/credentials`
```json
{
  "username": "dbadmin",
  "password": "password-generado-automaticamente"
}
```

#### `/{stackPrefix}-cf-keypair/private-key`
```json
{
  "keyPairId": "KXXXXXXXXXXXXX",
  "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

### SSM Parameter Store

- `/{stackPrefix}/database/endpoint` - Endpoint de RDS
- `/{stackPrefix}/s3/bucket` - Nombre del bucket S3
- `/{stackPrefix}/cloudfront/domain` - Dominio de CloudFront
- `/{stackPrefix}/cloudfront/distribution-id` - ID de distribución
- `/{stackPrefix}/cloudfront/keypair-id` - ID del key pair

## 🚀 Próximos Pasos

1. **Desplegar infraestructura con CDK**:
   ```bash
   cd infra
   npm install
   cdk bootstrap
   cdk deploy TrabajoYaStack-prod
   ```

2. **Configurar Secrets Manager** con los valores reales

3. **Construir y publicar imagen Docker**:
   ```bash
   cd Backend
   docker build -f Dockerfile.aws -t trabajoya-backend:latest .
   # Tag y push a ECR
   ```

4. **Verificar deployment** usando el checklist en `AWS_DEPLOYMENT_CHECKLIST.md`

## 📝 Notas Importantes

- El servicio `AwsConfigService` solo carga secrets en producción (`NODE_ENV=production`)
- En desarrollo, se usan las variables de entorno locales del archivo `.env`
- Las credenciales de AWS se obtienen automáticamente desde el IAM Role de EC2
- No es necesario configurar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en producción
- El health check endpoint está disponible en `/api/public/health`

## 🔍 Verificación

Para verificar que todo está configurado correctamente:

1. **Verificar que el servicio carga secrets**:
   - Revisar logs de la aplicación al iniciar
   - Debe mostrar "Cargando configuración desde AWS..." en producción

2. **Verificar variables de entorno**:
   ```bash
   # Desde EC2 via SSM
   aws ssm start-session --target <instance-id>
   sudo docker exec trabajoya-prod-backend env | grep JWT
   ```

3. **Verificar conectividad**:
   - Health check: `curl http://<ALB-DNS>/api/public/health`
   - Base de datos: Verificar logs de Prisma
   - S3: Intentar subir un archivo
   - CloudFront: Verificar signed cookies

## 📚 Referencias

- [README_DEPLOY.md](./README_DEPLOY.md) - Guía completa de deployment
- [AWS_DEPLOYMENT_CHECKLIST.md](./AWS_DEPLOYMENT_CHECKLIST.md) - Checklist de deployment
- [.env.example](./.env.example) - Variables de entorno de ejemplo

