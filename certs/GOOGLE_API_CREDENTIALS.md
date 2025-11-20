# Credenciales para Google API

## 🔑 Huella Digital SHA-1

```
2C:35:1E:D1:FB:3F:B4:FB:48:80:2D:0B:5F:0F:DB:89:7D:20:46:67
```

## 🔐 Huella Digital SHA-256

```
5C:F3:4C:09:2C:2E:49:54:24:8B:9A:6F:90:A3:F1:5F:59:F1:87:55:73:01:9A:D2:E6:D4:CB:92:61:10:54:72
```

---

## 📋 Información del Keystore

- **Ubicación**: `./certs/debug.keystore`
- **Alias**: `androiddebugkey`
- **Contraseña del Store**: `android`
- **Contraseña de la Key**: `android`
- **Tipo**: PrivateKeyEntry (RSA 2048 bits)
- **Validez**: Hasta el 10 de marzo de 2053

---

## 🚀 Cómo usar con Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto o crea uno nuevo
3. Ve a **APIs y Servicios** > **Credenciales**
4. Crea o edita una credencial OAuth 2.0
5. Agrega la huella digital SHA-1 en la sección correspondiente

### Para Android:

- Tipo: Aplicación Android
- Nombre del paquete: (tu package name)
- Huella digital SHA-1: `2C:35:1E:D1:FB:3F:B4:FB:48:80:2D:0B:5F:0F:DB:89:7D:20:46:67`

### Para OAuth Web:

- Usa ambas huellas (SHA-1 y SHA-256) según lo requiera Google

---

## ⚙️ Comandos útiles

### Ver información del certificado:

```bash
keytool -list -v -keystore certs/debug.keystore -alias androiddebugkey -storepass android
```

### Obtener solo SHA-1:

```bash
keytool -list -keystore certs/debug.keystore -alias androiddebugkey -storepass android | grep SHA1
```

### Generar un nuevo keystore para producción:

```bash
keytool -genkey -v -keystore production.keystore -alias mykey -keyalg RSA -keysize 2048 -validity 10000
```

---

## ⚠️ IMPORTANTE

**Este es un keystore de DESARROLLO/DEBUG**.

- ✅ Úsalo para desarrollo y pruebas
- ❌ NO lo uses en producción
- ❌ NO lo compartas públicamente
- ❌ NO lo subas a git (ya está en .gitignore)

Para producción, genera un nuevo keystore con una contraseña segura y guárdalo en un lugar seguro.

---

## 📱 Servicios de Google que requieren SHA-1

- Google Sign-In
- Google Maps API
- Firebase Authentication
- Google Drive API
- YouTube API
- Google Play Services
