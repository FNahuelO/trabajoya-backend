# Checklist de Deployment a AWS - TrabajoYa Backend

Este documento contiene un checklist completo para asegurar que el backend esté listo para el deployment a AWS.

## ✅ Pre-Deployment Checklist

### 1. Variables de Entorno

#### Variables Requeridas en Secrets Manager (`/trabajoya-prod/app/config`)

- [ ] `JWT_ACCESS_SECRET` - Secret para firmar JWT access tokens
- [ ] `JWT_REFRESH_SECRET` - Secret para refresh tokens (opcional, actualmente no se usa)
- [ ] `JWT_ACCESS_EXPIRES_IN` - Expiración del access token (default: "15m")
- [ ] `JWT_REFRESH_EXPIRES_IN` - Expiración del refresh token (default: "7d")
- [ ] `MAIL_FROM` - Email desde el cual se envían los correos
- [ ] `GOOGLE_CLIENT_ID` - ID del cliente de Google OAuth (si se usa)
- [ ] `GOOGLE_CLIENT_SECRET` - Secret del cliente de Google OAuth (si se usa)
- [ ] `APPLE_CLIENT_ID` - ID del cliente de Apple OAuth (si se usa)
- [ ] `APPLE_REDIRECT_URI` - URI de redirección de Apple OAuth (si se usa)
- [ ] `OPENAI_API_KEY` - API key de OpenAI (si se usa)
- [ ] `PAYPAL_CLIENT_ID` - ID del cliente de PayPal (si se usa)
- [ ] `PAYPAL_CLIENT_SECRET` - Secret del cliente de PayPal (si se usa)

#### Variables Requeridas en SSM Parameter Store

- [ ] `/{stackPrefix}/database/endpoint` - Endpoint de RDS PostgreSQL
- [ ] `/{stackPrefix}/s3/bucket` - Nombre del bucket S3
- [ ] `/{stackPrefix}/cloudfront/domain` - Dominio de CloudFront
- [ ] `/{stackPrefix}/cloudfront/distribution-id` - ID de la distribución CloudFront
- [ ] `/{stackPrefix}/cloudfront/keypair-id` - ID del key pair de CloudFront

#### Variables Requeridas en Secrets Manager (Base de Datos)

- [ ] `/{stackPrefix}/database/credentials` - Credenciales de RDS (username, password)

#### Variables Requeridas en Secrets Manager (CloudFront)

- [ ] `/{stackPrefix}-cf-keypair/private-key` - Clave privada de CloudFront para signed cookies

#### Variables de Entorno en EC2 (via user-data)

- [ ] `NODE_ENV=production`
- [ ] `PORT=4000`
- [ ] `DATABASE_URL` - Construida desde Secrets Manager
- [ ] `JWT_ACCESS_SECRET` - Desde Secrets Manager
- [ ] `AWS_REGION` - Región de AWS (ej: us-east-1)
- [ ] `S3_BUCKET_NAME` - Desde SSM Parameter Store
- [ ] `CLOUDFRONT_DOMAIN` - Desde SSM Parameter Store
- [ ] `CLOUDFRONT_DISTRIBUTION_ID` - Desde SSM Parameter Store
- [ ] `CLOUDFRONT_KEY_PAIR_ID` - Desde SSM Parameter Store
- [ ] `CLOUDFRONT_PRIVATE_KEY_SECRET_ARN` - ARN del secreto con la clave privada
- [ ] `APP_SECRETS_ARN` - ARN del secreto de la aplicación
- [ ] `DATABASE_SECRET_ARN` - ARN del secreto de la base de datos
- [ ] `STACK_PREFIX` - Prefijo del stack (ej: trabajoya-prod)

### 2. Configuración de AWS

#### IAM Roles y Permisos

- [ ] EC2 Role tiene permisos para:
  - [ ] ECR: `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`
  - [ ] Secrets Manager: `secretsmanager:GetSecretValue`, `secretsmanager:DescribeSecret`
  - [ ] SSM Parameter Store: `ssm:GetParameter`
  - [ ] S3: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`
  - [ ] CloudWatch Logs: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
  - [ ] SSM Session Manager: `ssm:StartSession` (para debugging)

#### S3 Bucket

- [ ] Bucket creado y configurado
- [ ] CORS configurado correctamente
- [ ] Bucket policy permite acceso desde CloudFront OAC
- [ ] Encriptación habilitada (S3-managed keys)
- [ ] Versionado deshabilitado (o configurado según necesidades)
- [ ] Lifecycle rules configuradas (eliminar objetos antiguos)

#### CloudFront Distribution

- [ ] Distribución creada
- [ ] Origin Access Control (OAC) configurado
- [ ] Key Pair creado para signed cookies
- [ ] Key Group creado y asociado
- [ ] CORS headers configurados
- [ ] Cache policy configurada
- [ ] Price class configurada (PRICE_CLASS_100 para reducir costos)

#### RDS PostgreSQL

- [ ] Instancia RDS creada
- [ ] Security Group permite tráfico desde EC2 en puerto 5432
- [ ] Base de datos `trabajoya` creada
- [ ] Credenciales guardadas en Secrets Manager
- [ ] Backup configurado
- [ ] Multi-AZ deshabilitado (para reducir costos en desarrollo)

#### ECR Repository

- [ ] Repositorio creado
- [ ] Lifecycle policy configurada (mantener últimas 10 imágenes)
- [ ] Image scanning habilitado

### 3. Código y Build

#### Dockerfile.aws

- [ ] Dockerfile.aws optimizado con multi-stage build
- [ ] Prisma Client generado correctamente
- [ ] Entrypoint script ejecuta migraciones antes de iniciar
- [ ] Variables de entorno configuradas correctamente

#### Build y Push

- [ ] Imagen Docker construida localmente y probada
- [ ] Imagen pushada a ECR con tag `latest`
- [ ] Imagen también taggeada con commit hash

#### Migraciones de Base de Datos

- [ ] Todas las migraciones de Prisma aplicadas
- [ ] Seed data ejecutado (si es necesario)
- [ ] Admin user creado (si es necesario)

### 4. Configuración de la Aplicación

#### Health Check

- [ ] Endpoint `/api/public/health` funciona correctamente
- [ ] Health check configurado en ALB Target Group

#### CORS

- [ ] `ALLOWED_ORIGINS` configurado con los dominios correctos
- [ ] No usar `*` en producción

#### Swagger

- [ ] `SWAGGER_ENABLED=false` en producción (o configurado con autenticación)

#### Logging

- [ ] Logs configurados para enviar a CloudWatch
- [ ] Niveles de log apropiados para producción

### 5. Seguridad

#### Secrets

- [ ] Todos los secrets en Secrets Manager (no en código)
- [ ] Secrets rotados regularmente
- [ ] No hay secrets hardcodeados en el código

#### SSL/TLS

- [ ] Certificado SSL configurado en ACM (si se usa HTTPS)
- [ ] Listener HTTPS configurado en ALB (si se usa)

#### Security Groups

- [ ] Security Groups configurados con principio de menor privilegio
- [ ] Solo puertos necesarios abiertos
- [ ] RDS solo accesible desde EC2

### 6. Monitoreo y Alertas

#### CloudWatch

- [ ] Log groups creados
- [ ] Métricas configuradas
- [ ] Alarmas configuradas para:
  - [ ] CPU alta
  - [ ] Memoria alta
  - [ ] Health check failures
  - [ ] Errores de aplicación

### 7. Testing Post-Deployment

- [ ] Health check responde correctamente
- [ ] API endpoints funcionan correctamente
- [ ] Autenticación funciona (login, registro)
- [ ] Upload de archivos a S3 funciona
- [ ] CloudFront signed cookies funcionan
- [ ] Emails se envían correctamente (SES)
- [ ] Base de datos conecta correctamente
- [ ] Migraciones aplicadas correctamente

## 📝 Comandos Útiles

### Verificar Secrets en Secrets Manager

```bash
aws secretsmanager get-secret-value \
  --secret-id /trabajoya-prod/app/config \
  --query SecretString --output text | jq
```

### Verificar Parámetros SSM

```bash
aws ssm get-parameter \
  --name /trabajoya-prod/s3/bucket \
  --query Parameter.Value --output text
```

### Ver Logs de la Aplicación

```bash
# Desde EC2 via SSM Session Manager
aws ssm start-session --target <instance-id>

# Dentro de la instancia
sudo docker logs trabajoya-prod-backend -f
```

### Verificar Health Check

```bash
curl http://<ALB-DNS>/api/public/health
```

### Forzar Redeploy

```bash
# Obtener instancia ID
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names TrabajoYaStack-prod-BackendASG-ASG-* \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' \
  --output text)

# Reiniciar instancia
aws ec2 reboot-instances --instance-ids $INSTANCE_ID
```

## 🚨 Troubleshooting

### La aplicación no inicia

1. Verificar logs: `docker logs trabajoya-prod-backend`
2. Verificar que DATABASE_URL esté correcta
3. Verificar que JWT_ACCESS_SECRET esté configurado
4. Verificar que las migraciones de Prisma se ejecutaron

### No se pueden subir archivos a S3

1. Verificar permisos del IAM Role
2. Verificar que S3_BUCKET_NAME esté configurado
3. Verificar que el bucket existe

### CloudFront no sirve archivos

1. Verificar que las signed cookies se generan correctamente
2. Verificar que el Key Pair ID es correcto
3. Verificar que la clave privada está en Secrets Manager
4. Verificar que el OAC está configurado correctamente

### Emails no se envían

1. Verificar que SES está configurado en la región correcta
2. Verificar que el dominio/email está verificado en SES
3. Verificar que MAIL_FROM está configurado
4. Verificar que MAIL_PROVIDER=ses

## 📚 Referencias

- [README_DEPLOY.md](./README_DEPLOY.md) - Guía completa de deployment
- [.env.example](./.env.example) - Variables de entorno de ejemplo
- [AWS CDK Infrastructure](../infra/) - Código de infraestructura

