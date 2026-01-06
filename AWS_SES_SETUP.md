# Configuración de AWS SES para Envío de Emails

Este documento explica cómo configurar AWS SES (Simple Email Service) para el envío de emails en el backend de TrabajoYa, utilizando el **free tier de AWS**.

## ⚡ Respuesta Rápida

**¿Puedo enviar emails a cada usuario cuando se registra?**

**Sí, pero necesitas salir del "sandbox" primero.**

Por defecto, AWS SES está en modo sandbox, donde solo puedes enviar a direcciones verificadas manualmente. Para enviar a cualquier usuario que se registre:

1. **Solicita "Production Access"** en la consola de AWS SES (gratis, aprobación en 24-48 horas)
2. Mientras tanto, puedes usar otro proveedor temporalmente o verificar algunos emails de prueba

**Pasos rápidos:**

- Ve a AWS SES → Account dashboard → "Request production access"
- Completa el formulario (tipo: Transactional, describe tu caso de uso)
- Espera la aprobación (generalmente 24-48 horas)

Una vez aprobado, podrás enviar a cualquier dirección de email sin costo adicional (dentro del free tier).

## 📋 Requisitos Previos

1. Una cuenta de AWS (si no tienes una, puedes crear una en [aws.amazon.com](https://aws.amazon.com))
2. Acceso a la consola de AWS SES

## 🚀 Configuración Paso a Paso

### 1. Verificar Email o Dominio en AWS SES

Tienes dos opciones para verificar tu identidad en AWS SES:

#### Opción A: Verificar un Dominio Completo (Recomendado) 🌟

Esta es la **mejor opción** porque te permite enviar desde cualquier email de tu dominio (ej: `noreply@tudominio.com`, `support@tudominio.com`, etc.):

1. Ve a la consola de AWS SES: [https://console.aws.amazon.com/ses/](https://console.aws.amazon.com/ses/)
2. En el menú lateral, selecciona **"Verified identities"**
3. Haz clic en **"Create identity"**
4. Selecciona **"Domain"**
5. Ingresa tu dominio (ej: `tudominio.com`)
6. Haz clic en **"Create identity"**
7. AWS te dará registros DNS que debes agregar a tu proveedor de dominio:
   - Registros TXT para verificación
   - Registros MX (opcional, para recibir emails)
   - Registros CNAME para DKIM (recomendado para mejor deliverability)
8. Una vez agregados los registros DNS, AWS verificará automáticamente tu dominio (puede tomar hasta 72 horas)

**Ventajas:**

- Puedes usar cualquier email de tu dominio como remitente
- Mejor deliverability (menos probabilidad de ir a spam)
- No necesitas verificar cada email individualmente

#### Opción B: Verificar un Email Individual

Si no tienes un dominio propio, puedes verificar un email específico:

1. Ve a la consola de AWS SES: [https://console.aws.amazon.com/ses/](https://console.aws.amazon.com/ses/)
2. En el menú lateral, selecciona **"Verified identities"**
3. Haz clic en **"Create identity"**
4. Selecciona **"Email address"**
5. Ingresa el email que usarás como remitente (ej: `noreply@gmail.com`)
6. Haz clic en **"Create identity"**
7. Revisa tu bandeja de entrada y haz clic en el enlace de verificación que AWS envió

### 2. Salir del Sandbox (IMPORTANTE para Producción) 🚨

**Por defecto, AWS SES está en modo "sandbox"**, lo que significa que:

- ❌ Solo puedes enviar emails **a direcciones verificadas**
- ❌ No puedes enviar a usuarios reales que se registren en tu app

**Para enviar emails a cualquier usuario, necesitas solicitar salir del sandbox:**

1. Ve a la consola de AWS SES
2. En el menú lateral, selecciona **"Account dashboard"**
3. Busca la sección **"Sending statistics"** o **"Account status"**
4. Haz clic en **"Request production access"** o **"Edit your account details"**
5. Completa el formulario con:
   - **Mail Type**: Transactional (para emails de verificación, reset de contraseña, etc.)
   - **Website URL**: URL de tu aplicación
   - **Use case description**: Describe cómo usarás SES (ej: "Envío de emails de verificación y recuperación de contraseña para usuarios de mi aplicación")
   - **Expected sending volume**: Estimación de emails por día/mes
6. Acepta los términos y envía la solicitud

**Tiempo de aprobación:**

- Generalmente toma **24-48 horas**
- Puede ser instantáneo si tu cuenta AWS tiene historial
- Es **completamente gratuito** (no hay costo adicional)

**Mientras esperas la aprobación:**

- Puedes usar SMTP temporalmente para desarrollo/testing
- O verificar manualmente algunos emails de prueba en SES para testing

> **💡 Tip**: Si tienes un dominio verificado, la aprobación suele ser más rápida.

### 3. Obtener Credenciales de AWS

Tienes dos opciones para autenticarte con AWS:

#### Opción A: Usar IAM Roles (Recomendado para producción)

Si tu aplicación se ejecuta en EC2, ECS, Lambda u otro servicio de AWS, puedes usar IAM roles:

1. Crea un IAM role con permisos para SES
2. Asigna el role a tu instancia/servicio
3. No necesitas configurar `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`

**Política IAM mínima requerida:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

#### Opción B: Usar Access Keys (Para desarrollo local)

1. Ve a la consola de IAM: [https://console.aws.amazon.com/iam/](https://console.aws.amazon.com/iam/)
2. Selecciona **"Users"** en el menú lateral
3. Crea un nuevo usuario o selecciona uno existente
4. Ve a la pestaña **"Security credentials"**
5. Haz clic en **"Create access key"**
6. Selecciona **"Application running outside AWS"**
7. Copia el **Access Key ID** y **Secret Access Key**

### 4. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Proveedor de email (ses es el predeterminado si hay credenciales AWS)
MAIL_PROVIDER="ses"

# Email verificado en AWS SES (debe estar verificado)
MAIL_FROM="noreply@tudominio.com"

# Región de AWS donde está configurado SES
AWS_REGION="us-east-1"

# Credenciales de AWS (solo si usas Access Keys, no IAM roles)
AWS_ACCESS_KEY_ID="tu-access-key-id"
AWS_SECRET_ACCESS_KEY="tu-secret-access-key"
```

### 5. Verificar la Configuración

Una vez configurado, el backend usará automáticamente AWS SES cuando:

- `MAIL_PROVIDER="ses"` (o no esté configurado y haya credenciales AWS)
- Las credenciales de AWS estén disponibles (IAM role o Access Keys)
- `MAIL_FROM` esté configurado con un email verificado

## 📊 Límites del Free Tier de AWS SES

El free tier de AWS SES incluye:

- **62,000 emails por mes** (si envías desde una instancia EC2)
- **1,000 emails por día** (si envías desde fuera de AWS)
- **Sin costo** por los primeros 62,000 emails/mes

Después del free tier:

- $0.10 por cada 1,000 emails adicionales

> **Nota importante**: Estos límites aplican **después de salir del sandbox**. En modo sandbox, solo puedes enviar a direcciones verificadas, lo cual es muy limitado para una aplicación real.

## 🔍 Solución de Problemas

### Error: "MessageRejected"

**Causa**: El email "from" no está verificado en AWS SES.

**Solución**:

1. Verifica el email en la consola de AWS SES
2. Asegúrate de que `MAIL_FROM` en tu `.env` coincida exactamente con el email verificado

### Error: "MessageRejected" - "Email address is not verified"

**Causa**: Tu cuenta de AWS SES está en modo "sandbox" y estás intentando enviar a un email no verificado.

**Solución**:

1. **Solicita salir del sandbox** (recomendado para producción) - ve a "Account dashboard" → "Request production access"
2. Mientras tanto, puedes verificar temporalmente algunos emails de prueba en SES para testing
3. O usa SMTP temporalmente para desarrollo/testing hasta que se apruebe tu solicitud

> **⚠️ Importante**: Para una aplicación real donde los usuarios se registran, **debes salir del sandbox**. No es práctico verificar cada email de usuario manualmente.

### Error: "InvalidParameterValue"

**Causa**: La región de AWS no coincide o las credenciales son incorrectas.

**Solución**:

1. Verifica que `AWS_REGION` coincida con la región donde configuraste SES
2. Verifica que las credenciales de AWS sean correctas

### No se envían emails en desarrollo local

**Causa**: Faltan las credenciales de AWS.

**Solución**:

1. Configura `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en tu `.env`
2. O configura un perfil de AWS usando `aws configure`

## 🔐 Seguridad

- **Nunca** subas tus credenciales de AWS al repositorio
- Usa IAM roles en producción cuando sea posible
- Rota tus Access Keys regularmente
- Usa políticas IAM con el principio de menor privilegio

## 📚 Recursos Adicionales

- [Documentación oficial de AWS SES](https://docs.aws.amazon.com/ses/)
- [Precios de AWS SES](https://aws.amazon.com/ses/pricing/)
- [Guía de verificación de identidades](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)
- [Solicitar salir del sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
