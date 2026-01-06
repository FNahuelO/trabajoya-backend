# Guía de Configuración: Google OAuth, iOS OAuth y Google Meet

Esta guía te ayudará a configurar completamente la autenticación con Google, iOS (Apple) y la integración con Google Meet para videollamadas.

---

## 📋 Tabla de Contenidos

1. [Configuración de Google OAuth](#1-configuración-de-google-oauth)
2. [Configuración de iOS (Apple) OAuth](#2-configuración-de-ios-apple-oauth)
3. [Configuración de Google Meet API](#3-configuración-de-google-meet-api)
4. [Variables de Entorno](#4-variables-de-entorno)
5. [Configuración en AWS (Producción)](#5-configuración-en-aws-producción)
6. [Páginas Públicas Requeridas](#6-páginas-públicas-requeridas)
7. [Pruebas y Verificación](#7-pruebas-y-verificación)
8. [Troubleshooting](#8-troubleshooting)
9. [Seguridad](#9-seguridad)
10. [Recursos Adicionales](#10-recursos-adicionales)
11. [Checklist Final](#11-checklist-final)

---

## 1. Configuración de Google OAuth

### 1.1 Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID** para referencia

### 1.2 Habilitar APIs Necesarias

1. Ve a **APIs y Servicios** > **Biblioteca**
2. Busca y habilita las siguientes APIs:
   - ✅ **Google+ API** (para autenticación)
   - ✅ **Google Calendar API** (requerida para Google Meet)
   - ✅ **Google Meet API** (para crear reuniones)

### 1.3 Crear Credenciales OAuth 2.0

1. Ve a **APIs y Servicios** > **Credenciales**
2. Haz clic en **+ CREAR CREDENCIALES** > **ID de cliente de OAuth 2.0**
3. Si es la primera vez, configura la pantalla de consentimiento:

   - **Tipo de usuario**: Externo
   - **Nombre de la app**: TrabajoYa
   - **Email de soporte**: tu-email@ejemplo.com
   - **Dominios autorizados**: trabajo-ya.com
   - **Página principal de la aplicación**: `https://trabajo-ya.com`
     - Puede ser tu backoffice, landing page, o una página informativa
     - No necesita ser la app móvil misma, solo una página web accesible
   - **Vínculo a la Política de Privacidad**: `https://trabajo-ya.com/privacy-policy`
   - **Vínculo a las Condiciones del Servicio**: `https://trabajo-ya.com/terms-of-service`
   - **Scopes**:
     - `email`
     - `profile`
     - `openid`
     - `https://www.googleapis.com/auth/calendar` (para Google Meet)

⚠️ **IMPORTANTE**: Las páginas de Política de Privacidad y Términos y Condiciones deben estar disponibles públicamente en tu frontend (trabajo-ya.com) antes de configurar OAuth. Estas páginas NO deben estar en el backend, sino en el frontend/backoffice como páginas públicas.

4. Crea los IDs de cliente OAuth 2.0 (necesitas crear uno SEPARADO para cada tipo de aplicación):

   **a) ID de Cliente para Web:**

   - Haz clic en **+ CREAR CREDENCIALES** > **ID de cliente de OAuth 2.0**
   - **Tipo de aplicación**: Aplicación web
   - **Nombre**: TrabajoYa Web Client
   - **Orígenes autorizados de JavaScript**:
     - `http://localhost:3000` (desarrollo)
     - `http://localhost:19006` (Expo)
     - `https://trabajo-ya.com` (producción)
   - **URI de redirección autorizados**:
     - `http://localhost:3000/auth/google/callback` (desarrollo)
     - `https://trabajo-ya.com/auth/google/callback` (producción)
   - Guarda el **ID de cliente** y **Secreto de cliente** obtenidos

   **b) ID de Cliente para Android (si aplica):**

   - Haz clic en **+ CREAR CREDENCIALES** > **ID de cliente de OAuth 2.0** (de nuevo)
   - **Tipo de aplicación**: Android
   - **Nombre**: TrabajoYa Android Client
   - **Nombre del paquete**: `com.trabajoya.app` (debe coincidir con tu app Android)
   - **Huella digital SHA-1**: (ver sección 1.5 más abajo para obtenerla)
   - Guarda el **ID de cliente** obtenido (Android no usa secreto de cliente)

   **c) ID de Cliente para iOS (si aplica):**

   - Haz clic en **+ CREAR CREDENCIALES** > **ID de cliente de OAuth 2.0** (de nuevo)
   - **Tipo de aplicación**: iOS
   - **Nombre**: TrabajoYa iOS Client
   - **ID del paquete**: `com.trabajoya.app` (debe coincidir con tu app iOS)
   - Guarda el **ID de cliente** obtenido (iOS no usa secreto de cliente)

   **d) ID de Cliente para Expo (Aplicaciones Móviles con React Native/Expo):**

   ⚠️ **CRÍTICO**: Para aplicaciones móviles con Expo, necesitas configurar los redirect URIs en el ID de cliente de **Web** (no crear uno nuevo).

   - Edita el **ID de Cliente para Web** que creaste anteriormente
   - En la sección **"URI de redirección autorizados"**, agrega los siguientes URIs:

   **Para desarrollo con Expo Go:**
   - `https://auth.expo.io/@[TU_USERNAME]/[TU_SLUG]`
   - Ejemplo: `https://auth.expo.io/@usuario/TrabajoYa`
   - También puedes usar: `exp://localhost:8081/--/redirect-google` (para desarrollo local)

   **Para producción (app standalone):**
   - `trabajoya://redirect-google` (basado en el scheme configurado en `app.json`)
   - El formato es: `[TU_SCHEME]://redirect-google`
   - Verifica el scheme en tu `app.json` (debería ser `"scheme": "trabajoya"`)

   **Cómo obtener el redirect URI exacto:**
   
   1. Ejecuta tu app en desarrollo
   2. Intenta iniciar sesión con Google
   3. Revisa los logs de la consola - verás un mensaje como:
      ```
      [Register - Google] redirect URI: https://auth.expo.io/@usuario/TrabajoYa
      ```
   4. Copia ese URI exacto y agrégalo en Google Cloud Console

   **Nota importante**: Si ves un error 404 al intentar autenticarte con Google, es muy probable que el redirect URI no esté configurado correctamente en Google Cloud Console. Verifica que el URI en los logs coincida exactamente con uno de los URIs autorizados.

⚠️ **IMPORTANTE**:

- Cada tipo de aplicación (Web, Android, iOS) requiere su PROPIO ID de cliente OAuth 2.0
- NO puedes usar el mismo ID de cliente para diferentes tipos de aplicación
- El ID de cliente de Web usa un "Secreto de cliente", pero Android e iOS NO usan secreto
- Para Expo, usa el ID de cliente de Web pero agrega los redirect URIs específicos de Expo
- Guarda todas las credenciales de forma segura

### 1.4 Obtener Credenciales

Después de crear los IDs de cliente, tendrás:

**Para Web:**

- **ID de cliente**: `xxxxx-web.apps.googleusercontent.com`
- **Secreto de cliente**: `xxxxx` (¡Importante! Solo para Web)

**Para Android:**

- **ID de cliente**: `xxxxx-android.apps.googleusercontent.com`
- No hay secreto de cliente (Android usa el SHA-1)

**Para iOS:**

- **ID de cliente**: `xxxxx-ios.apps.googleusercontent.com`
- No hay secreto de cliente (iOS usa el Bundle ID)

### 1.5 Configuración para Android (si aplica)

Si tienes una app Android, necesitas agregar la huella digital SHA-1:

1. Obtén la huella SHA-1 del keystore:

   ```bash
   # Para debug (desarrollo)
   keytool -list -v -keystore certs/debug.keystore -alias androiddebugkey -storepass android

   # Para producción
   keytool -list -v -keystore tu-keystore-produccion.jks -alias tu-alias
   ```

2. En Google Cloud Console, ve al ID de cliente Android que creaste y agrega la huella SHA-1

**Huella SHA-1 de desarrollo** (del archivo `certs/debug.keystore`):

```
2C:35:1E:D1:FB:3F:B4:FB:48:80:2D:0B:5F:0F:DB:89:7D:20:46:67
```

### 1.6 Dónde Usar Cada ID de Cliente

**IMPORTANTE**: Cada tipo de aplicación usa su propio ID de cliente:

- **Backend/API (`.env`)**: Usa el ID de cliente de **Web** + Secreto de cliente

  - `GOOGLE_CLIENT_ID` = ID del cliente Web
  - `GOOGLE_CLIENT_SECRET` = Secreto del cliente Web

- **App Android**: Configura el ID de cliente de **Android** directamente en tu código React Native/Expo

  - Este ID NO se usa en el backend
  - Se configura en el archivo de configuración de tu app móvil

- **App iOS**: Configura el ID de cliente de **iOS** directamente en tu código React Native/Expo
  - Este ID NO se usa en el backend
  - Se configura en el archivo de configuración de tu app móvil

---

## 2. Configuración de iOS (Apple) OAuth

### 2.1 Requisitos Previos

- Cuenta de desarrollador de Apple (Apple Developer Program)
- Acceso a [Apple Developer Portal](https://developer.apple.com/)

### 2.2 Crear App ID en Apple Developer

1. Ve a [Apple Developer Portal](https://developer.apple.com/account/)
2. Ve a **Certificates, Identifiers & Profiles**
3. Selecciona **Identifiers** > **+** (crear nuevo)
4. Selecciona **App IDs** > **Continue**
5. Configura:
   - **Description**: TrabajoYa
   - **Bundle ID**: `com.trabajoya.app` (debe coincidir con tu app)
   - **Capabilities**: Marca **Sign in with Apple**
6. Haz clic en **Continue** y luego **Register**

### 2.3 Crear Service ID para Web

1. En **Identifiers**, selecciona **Services IDs** > **+**
2. Configura:
   - **Description**: TrabajoYa Web Service
   - **Identifier**: `com.trabajoya.web` (o similar)
3. Marca **Sign in with Apple**
4. Haz clic en **Configure**:
   - **Primary App ID**: Selecciona el App ID creado anteriormente
   - **Website URLs**:
     - **Domains and Subdomains**: `trabajo-ya.com`
     - **Return URLs**:
       - `https://trabajo-ya.com/auth/apple/callback`
       - `http://localhost:4000/api/auth/apple/callback` (desarrollo)
5. Guarda y continúa

### 2.4 Crear Key para Autenticación

1. Ve a **Keys** > **+** (crear nueva)
2. Configura:
   - **Key Name**: TrabajoYa Apple Sign In Key
   - **Enable**: **Sign in with Apple**
3. Haz clic en **Continue** > **Register**
4. **⚠️ IMPORTANTE**: Descarga el archivo `.p8` (solo se puede descargar una vez)
5. Anota el **Key ID** que se muestra

### 2.5 Obtener Team ID

1. En la parte superior derecha del portal, verás tu **Team ID**
2. Anótalo (formato: `XXXXXXXXXX`)

### 2.6 Resumen de Credenciales Apple

Necesitarás:

- **Client ID (Service ID)**: `com.trabajoya.web`
- **Team ID**: `XXXXXXXXXX`
- **Key ID**: `XXXXXXXXXX`
- **Private Key**: Contenido del archivo `.p8` descargado

---

## 3. Configuración de Google Meet API

### 3.1 Habilitar Google Meet API

1. En Google Cloud Console, ve a **APIs y Servicios** > **Biblioteca**
2. Busca y habilita las siguientes APIs:
   - ✅ **Google Meet API**
   - ✅ **Google Calendar API** (requerida para crear reuniones)

### 3.2 Configurar OAuth para Google Meet

Google Meet requiere acceso a Google Calendar API para crear reuniones programadas.

**Scopes necesarios**:

- `https://www.googleapis.com/auth/calendar` - Para crear eventos de calendario con Google Meet
- `https://www.googleapis.com/auth/calendar.events` - Para gestionar eventos

### 3.3 Configurar Consentimiento OAuth

Asegúrate de que en la pantalla de consentimiento OAuth estén incluidos los scopes:

- `email`
- `profile`
- `openid`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

### 3.4 Usar Google Meet en la Aplicación

El servicio de Google Meet está integrado en el backend. Para usarlo:

1. **Autorizar Google Calendar** (una vez por usuario):

   - El usuario debe visitar: `GET /api/google-meet/auth-url`
   - Visitar la URL recibida para autorizar
   - Intercambiar el código: `POST /api/google-meet/authorize` con el código recibido
   - Guardar los tokens (`accessToken` y `refreshToken`) en la base de datos

2. **Crear una reunión con Google Meet**:

   - Al crear una videollamada (`POST /api/video-meetings`), si el usuario tiene tokens guardados,
     se creará automáticamente un enlace de Google Meet

3. **Nota importante**:
   - Los tokens de Google deben guardarse en la base de datos asociados al usuario
   - Puedes agregar campos `googleAccessToken` y `googleRefreshToken` al modelo `User` en Prisma
   - O crear una tabla separada para almacenar tokens OAuth de usuarios

---

## 4. Variables de Entorno

Actualiza tu archivo `.env` con las siguientes variables:

```env
# Google OAuth
# IMPORTANTE: Usa el ID de cliente de "Aplicación web" que creaste en Google Cloud Console
# Los IDs de cliente de Android e iOS se usan solo en las apps móviles, NO en el backend
GOOGLE_CLIENT_ID=tu-google-client-id-web.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-google-client-secret

# Apple OAuth
APPLE_CLIENT_ID=com.trabajoya.web
APPLE_TEAM_ID=tu-team-id
APPLE_KEY_ID=tu-key-id
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APPLE_REDIRECT_URI=https://trabajo-ya.com/api/auth/apple/callback

# Google Meet (usando las mismas credenciales de Google OAuth Web)
# No se requieren variables adicionales, se usa GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET del cliente Web
```

⚠️ **NOTA IMPORTANTE**:

- En el backend (`.env`), usa el **ID de cliente de Web** (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`)
- Los IDs de cliente de Android e iOS se configuran directamente en las apps móviles (React Native/Expo)
- El backend no necesita los IDs de cliente de Android/iOS, solo el de Web

### 4.1 Formato de APPLE_PRIVATE_KEY

El `APPLE_PRIVATE_KEY` debe incluir los saltos de línea como `\n`. Ejemplo:

```env
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----\n"
```

#### Cómo Leer el Contenido del Archivo .p8 o .key

Si tienes el archivo `private_key.key` (o cualquier archivo `.p8`), puedes leer su contenido con:

```bash
cat private_key.key
```

Luego necesitas convertir los saltos de línea reales a `\n` para ponerlo en el `.env`. Puedes hacerlo manualmente o usar este comando:

```bash
# Ver el contenido formateado para .env
cat private_key.key | sed ':a;N;$!ba;s/\n/\\n/g'
```

O simplemente copia el contenido completo del archivo y reemplaza cada salto de línea con `\n` manualmente.

⚠️ **IMPORTANTE**:

- El contenido completo debe estar en una sola línea en el `.env`, con `\n` en lugar de saltos de línea reales
- Debe estar entre comillas dobles
- Debe incluir `-----BEGIN PRIVATE KEY-----` al inicio y `-----END PRIVATE KEY-----` al final

---

## 5. Configuración en AWS (Producción)

### 5.1 Guardar Secretos en AWS Secrets Manager

1. Ve a AWS Console > **Secrets Manager**
2. Crea o actualiza el secreto de tu aplicación
3. Agrega las siguientes claves al JSON del secreto:

```json
{
  "GOOGLE_CLIENT_ID": "tu-google-client-id-web.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "tu-google-client-secret",
  "APPLE_CLIENT_ID": "com.trabajoya.web",
  "APPLE_TEAM_ID": "tu-team-id",
  "APPLE_KEY_ID": "tu-key-id",
  "APPLE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "APPLE_REDIRECT_URI": "https://trabajo-ya.com/api/auth/apple/callback"
}
```

⚠️ **NOTA**: En AWS Secrets Manager usa el ID de cliente de **Web**, no los de Android/iOS.

### 5.2 Actualizar aws-config.service.ts

El servicio `AwsConfigService` ya está configurado para cargar estas variables automáticamente en producción.

---

## 6. Páginas Públicas Requeridas

Google Cloud Console requiere que las siguientes páginas estén disponibles públicamente en tu dominio. Estas páginas deben estar en el **frontend/backoffice**, NO en el backend.

### 6.1 Páginas Necesarias

Debes crear las siguientes páginas públicas en tu frontend/backoffice (trabajo-ya.com):

1. **Página Principal (Homepage)**

   - URL: `https://trabajo-ya.com`
   - Debe ser accesible públicamente

   ⚠️ **Nota para Apps Móviles**:

   Aunque tu aplicación principal sea móvil, Google Cloud Console requiere una página web principal. Puedes usar:

   - **Opción A (Recomendada)**: El **backoffice/admin panel** como página principal

     - Si tu backoffice está en `https://trabajo-ya.com`, úsalo directamente
     - Puede ser una página simple de login/admin o dashboard

   - **Opción B**: Crear una **landing page simple** en el backoffice

     - Una página informativa sobre TrabajoYa
     - Incluir enlaces de descarga de la app (si aplica)
     - Enlaces a Política de Privacidad y Términos
     - Información básica sobre la plataforma

   - **Opción C**: Redirigir `https://trabajo-ya.com` a tu backoffice
     - Si el backoffice está en otra ruta (ej: `/admin`), redirigir la raíz allí
     - O crear una página simple que redirija

2. **Política de Privacidad**

   - URL: `https://trabajo-ya.com/privacy-policy`
   - Debe ser accesible públicamente
   - Debe contener información sobre cómo manejas los datos de los usuarios
   - ✅ Ya tienes esta página en `Backoffice/src/pages/public/PrivacyPolicyPage.tsx`

3. **Términos y Condiciones del Servicio**

   - URL: `https://trabajo-ya.com/terms-of-service`
   - Debe ser accesible públicamente
   - Debe contener los términos y condiciones de uso de tu plataforma
   - Debes crear esta página si no existe aún

### 6.2 Configuración en Google Cloud Console

Al configurar la pantalla de consentimiento OAuth en Google Cloud Console, deberás ingresar:

- **Página principal de la aplicación**: `https://trabajo-ya.com`
- **Vínculo a la Política de Privacidad**: `https://trabajo-ya.com/privacy-policy`
- **Vínculo a las Condiciones del Servicio**: `https://trabajo-ya.com/terms-of-service`

⚠️ **IMPORTANTE**:

- Estas páginas deben estar disponibles ANTES de configurar OAuth en Google Cloud Console
- Google verificará que estas URLs sean accesibles públicamente
- Las páginas deben estar en tu frontend/backoffice, no en el backend
- Deben responder con código HTTP 200 (OK)

---

## 7. Pruebas y Verificación

### 7.1 Probar Google OAuth

1. Inicia tu aplicación en desarrollo
2. Intenta registrarte/iniciar sesión con Google
3. Verifica que:
   - Se crea el usuario en la base de datos
   - Se asocia el `googleId`
   - Se generan los tokens JWT correctamente

### 7.2 Probar Apple OAuth

1. Usa un dispositivo iOS real (no funciona en simulador)
2. Intenta registrarte/iniciar sesión con Apple
3. Verifica que:
   - Se crea el usuario en la base de datos
   - Se asocia el `appleId`
   - Se generan los tokens JWT correctamente

### 7.3 Probar Google Meet

1. Crea una videollamada desde la aplicación
2. Verifica que:
   - Se crea el evento en Google Calendar
   - Se genera el enlace de Google Meet
   - El enlace es accesible

### 7.4 Verificar Logs

Revisa los logs del servidor para errores comunes:

- `Invalid Google token` - Verifica `GOOGLE_CLIENT_ID`
- `Apple authentication failed` - Verifica credenciales de Apple
- `Calendar API error` - Verifica que la API esté habilitada

---

## 8. Troubleshooting

### Error: "Invalid Google Token"

**Causas posibles**:

- `GOOGLE_CLIENT_ID` incorrecto
- Token expirado
- Cliente OAuth no configurado correctamente

**Solución**:

1. Verifica que `GOOGLE_CLIENT_ID` coincida con el creado en Google Cloud Console
2. Asegúrate de que los orígenes autorizados incluyan tu dominio/app

### Error: "Apple authentication failed"

**Causas posibles**:

- `APPLE_CLIENT_ID` incorrecto
- `APPLE_PRIVATE_KEY` mal formateada
- `APPLE_TEAM_ID` o `APPLE_KEY_ID` incorrectos

**Solución**:

1. Verifica que `APPLE_CLIENT_ID` sea el Service ID, no el Bundle ID
2. Asegúrate de que `APPLE_PRIVATE_KEY` tenga los saltos de línea `\n`
3. Verifica que el Team ID y Key ID sean correctos

### Error: "Calendar API not enabled"

**Solución**:

1. Ve a Google Cloud Console
2. Habilita **Google Calendar API**
3. Espera unos minutos para que se propague

### Error: "Insufficient permissions for Google Meet"

**Solución**:

1. Verifica que los scopes OAuth incluyan `https://www.googleapis.com/auth/calendar`
2. Re-autoriza la aplicación para obtener los nuevos permisos

---

## 9. Seguridad

### 9.1 Buenas Prácticas

- ✅ **Nunca** subas credenciales a Git
- ✅ Usa variables de entorno para todas las credenciales
- ✅ En producción, usa AWS Secrets Manager
- ✅ Rota las credenciales periódicamente
- ✅ Usa HTTPS en producción
- ✅ Limita los orígenes autorizados en OAuth

### 9.2 Archivos a Ignorar

Asegúrate de que `.env` y archivos de credenciales estén en `.gitignore`:

```
.env
*.p8
*.p12
*.keystore
certs/
```

---

## 9. Recursos Adicionales

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Google Meet API Documentation](https://developers.google.com/meet/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)

---

## 11. Checklist Final

Antes de considerar la configuración completa, verifica:

- [ ] Google OAuth configurado y funcionando
- [ ] Apple OAuth configurado y funcionando
- [ ] Google Meet API habilitada
- [ ] Variables de entorno configuradas
- [ ] Credenciales guardadas en AWS Secrets Manager (producción)
- [ ] Pruebas de registro/login con Google exitosas
- [ ] Pruebas de registro/login con Apple exitosas
- [ ] Pruebas de creación de Google Meet exitosas
- [ ] Logs sin errores relacionados con OAuth

---

**¿Necesitas ayuda?** Revisa los logs del servidor y los errores específicos para diagnosticar problemas.
