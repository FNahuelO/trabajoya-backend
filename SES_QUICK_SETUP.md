# Guía Rápida: Configurar AWS SES

Esta guía te ayudará a configurar AWS SES en 5 pasos para empezar a enviar emails.

## ✅ Checklist de Configuración

### Paso 1: Verificar Email o Dominio en AWS SES

**Opción A: Verificar un Dominio (Recomendado)**
1. Ve a [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Selecciona tu región (ej: `us-east-1`)
3. Ve a **"Verified identities"** → **"Create identity"**
4. Selecciona **"Domain"** e ingresa tu dominio (ej: `tudominio.com`)
5. Agrega los registros DNS que AWS te proporciona a tu proveedor de dominio
6. Espera la verificación (puede tomar hasta 72 horas, pero generalmente es más rápido)

**Opción B: Verificar un Email Individual**
1. Ve a [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Selecciona tu región
3. Ve a **"Verified identities"** → **"Create identity"**
4. Selecciona **"Email address"** e ingresa tu email
5. Revisa tu bandeja y haz clic en el enlace de verificación

### Paso 2: Solicitar Salir del Sandbox (IMPORTANTE)

⚠️ **Sin esto, solo podrás enviar a emails verificados manualmente.**

1. En la consola de SES, ve a **"Account dashboard"**
2. Busca **"Sending statistics"** o **"Account status"**
3. Haz clic en **"Request production access"** o **"Edit your account details"**
4. Completa el formulario:
   - **Mail Type**: Transactional
   - **Website URL**: URL de tu aplicación
   - **Use case**: "Envío de emails de verificación y recuperación de contraseña para usuarios de mi aplicación"
   - **Expected sending volume**: Tu estimación (ej: "500-1000 emails por día")
5. Envía la solicitud

⏱️ **Tiempo de aprobación**: 24-48 horas (puede ser instantáneo)

### Paso 3: Obtener Credenciales de AWS

**Opción A: Usar IAM Roles (Producción en AWS)**
- Si tu app corre en EC2/ECS/Lambda, crea un IAM role con permisos SES
- No necesitas Access Keys

**Opción B: Usar Access Keys (Desarrollo local)**
1. Ve a [IAM Console](https://console.aws.amazon.com/iam/)
2. **Users** → Selecciona o crea un usuario
3. **Security credentials** → **Create access key**
4. Selecciona **"Application running outside AWS"**
5. Copia el **Access Key ID** y **Secret Access Key**

### Paso 4: Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Proveedor de email
MAIL_PROVIDER="ses"

# Email verificado en AWS SES
MAIL_FROM="noreply@tudominio.com"

# Región de AWS donde configuraste SES
AWS_REGION="us-east-1"

# Credenciales de AWS (solo si usas Access Keys)
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

### Paso 5: Verificar la Configuración

1. Reinicia tu backend
2. Busca en los logs: `"SES Provider inicializado para región: us-east-1"`
3. Intenta registrar un usuario o solicitar reset de contraseña
4. Revisa los logs para ver si el email se envió correctamente

## 🔍 Verificar Estado del Sandbox

Para verificar si ya saliste del sandbox:

1. Ve a [AWS SES Console](https://console.aws.amazon.com/ses/)
2. **Account dashboard**
3. Busca **"Account status"** o **"Sending limits"**
4. Si ves **"Production access"** o límites altos (ej: 50,000/día), ya saliste del sandbox ✅
5. Si ves **"Sandbox"** o límites bajos (ej: 200/día), aún estás en sandbox ⚠️

## 🚨 Problemas Comunes

### Error: "MessageRejected - Email address is not verified"

**Causa**: Estás en sandbox y el email destinatario no está verificado.

**Solución**: 
- Solicita salir del sandbox (Paso 2)
- O verifica temporalmente el email destinatario en SES para testing

### Error: "MessageRejected - Email address not verified"

**Causa**: El email "from" no está verificado.

**Solución**: 
- Verifica el email o dominio en SES (Paso 1)
- Asegúrate que `MAIL_FROM` coincida exactamente con el email verificado

### Error: "InvalidParameterValue" o "InvalidClientTokenId"

**Causa**: Credenciales de AWS incorrectas o región incorrecta.

**Solución**:
- Verifica que `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` sean correctas
- Verifica que `AWS_REGION` coincida con la región donde configuraste SES

### No se envían emails

**Causa**: Faltan credenciales o configuración.

**Solución**:
1. Verifica que todas las variables de entorno estén configuradas
2. Revisa los logs del backend al iniciar
3. Verifica que el email "from" esté verificado en SES

## 📊 Límites del Free Tier

- **62,000 emails/mes gratis** (si envías desde EC2/ECS/Lambda)
- **1,000 emails/día gratis** (si envías desde fuera de AWS)
- Después: $0.10 por cada 1,000 emails adicionales

## ✅ Checklist Final

Antes de usar en producción, verifica:

- [ ] Email o dominio verificado en SES
- [ ] Solicitud de salir del sandbox enviada (y aprobada)
- [ ] Variables de entorno configuradas
- [ ] Credenciales de AWS configuradas (Access Keys o IAM role)
- [ ] Prueba de envío exitosa
- [ ] Logs muestran "Email enviado exitosamente"

## 🔗 Enlaces Útiles

- [AWS SES Console](https://console.aws.amazon.com/ses/)
- [IAM Console](https://console.aws.amazon.com/iam/)
- [Documentación completa de SES](./AWS_SES_SETUP.md)

