# Guía de Migración a Google Cloud - Desde la Consola Web

Esta guía te llevará paso a paso para migrar el backend de TrabajoYa a Google Cloud Platform usando la **consola web de Google Cloud** (console.cloud.google.com), con prioridad en mantener funcionando perfectamente los sistemas de mensajes y llamadas.

## 📋 Tabla de Contenidos

1. [Preparación Inicial](#preparación-inicial)
2. [Paso 1: Crear Proyecto en Google Cloud](#paso-1-crear-proyecto-en-google-cloud)
3. [Paso 2: Habilitar APIs Necesarias](#paso-2-habilitar-apis-necesarias)
4. [Paso 3: Crear Base de Datos (Cloud SQL)](#paso-3-crear-base-de-datos-cloud-sql)
5. [Paso 4: Crear Bucket de Almacenamiento (Cloud Storage)](#paso-4-crear-bucket-de-almacenamiento-cloud-storage)
6. [Paso 5: Configurar Secret Manager](#paso-5-configurar-secret-manager)
7. [Paso 6: Desplegar Backend en Cloud Run](#paso-6-desplegar-backend-en-cloud-run)
8. [Paso 7: Configurar WebSockets (CRÍTICO)](#paso-7-configurar-websockets-crítico)
9. [Paso 8: Configurar CI/CD con Cloud Build](#paso-8-configurar-cicd-con-cloud-build)
10. [Paso 9: Verificar Funcionamiento](#paso-9-verificar-funcionamiento)
11. [Troubleshooting](#troubleshooting)

---

## Preparación Inicial

### Requisitos Previos

1. **Cuenta de Google Cloud**: Si no tienes una, crea una en [cloud.google.com](https://cloud.google.com)
2. **Proyecto de Google Cloud**: Necesitarás crear o tener acceso a un proyecto
3. **Datos de Migración**: 
   - Backup de la base de datos PostgreSQL
   - Lista de archivos en S3 (si aplica)
   - Variables de entorno actuales

### Información que Necesitarás

Antes de empezar, ten a mano:
- ✅ Nombre del proyecto de Google Cloud
- ✅ Región preferida (recomendado: `us-central1`)
- ✅ Contraseña para la base de datos
- ✅ Secrets de JWT (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
- ✅ Otras variables de entorno (GOOGLE_CLIENT_ID, OPENAI_API_KEY, etc.)

---

## Paso 1: Crear Proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Si no tienes un proyecto, haz clic en el selector de proyectos (arriba a la izquierda)
3. Haz clic en **"NUEVO PROYECTO"**
4. Completa:
   - **Nombre del proyecto**: `trabajoya-backend` (o el que prefieras)
   - **Organización**: Selecciona tu organización (si aplica)
5. Haz clic en **"CREAR"**
6. Espera a que se cree el proyecto (puede tomar unos segundos)
7. Selecciona el proyecto recién creado desde el selector de proyectos

### Habilitar Facturación

⚠️ **IMPORTANTE**: Cloud Run y Cloud SQL requieren facturación habilitada

1. Ve a **Facturación** en el menú lateral
2. Si no tienes una cuenta de facturación, crea una
3. Asocia la cuenta de facturación con tu proyecto

---

## Paso 2: Habilitar APIs Necesarias

1. Ve a **"APIs y servicios"** → **"Biblioteca"** en el menú lateral
2. Busca y habilita las siguientes APIs (una por una):

### APIs Requeridas:

#### a) Cloud Run API
- Busca: `Cloud Run API`
- Haz clic en **"HABILITAR"**

#### b) Cloud SQL Admin API
- Busca: `Cloud SQL Admin API`
- Haz clic en **"HABILITAR"**

#### c) Cloud Storage API
- Busca: `Cloud Storage API`
- Haz clic en **"HABILITAR"**

#### d) Cloud Build API
- Busca: `Cloud Build API`
- Haz clic en **"HABILITAR"**

#### e) Secret Manager API
- Busca: `Secret Manager API`
- Haz clic en **"HABILITAR"**

#### f) Compute Engine API
- Busca: `Compute Engine API`
- Haz clic en **"HABILITAR"**

**Nota**: Esto puede tomar 1-2 minutos por API. Espera a que cada una muestre "API habilitada".

---

## Paso 3: Crear Base de Datos (Cloud SQL)

### 3.1 Crear Instancia de Cloud SQL

1. Ve a **"SQL"** en el menú lateral (o busca "Cloud SQL" en la barra de búsqueda)
2. Haz clic en **"CREAR INSTANCIA"**
3. Selecciona **"PostgreSQL"**
4. Completa la configuración:

#### Configuración Básica:
- **ID de instancia**: `trabajoya-db`
- **Contraseña de root**: ⚠️ **GUARDA ESTA CONTRASEÑA** (la necesitarás después)
- **Región**: `us-central1` (o la región que prefieras)
- **Zona**: Selecciona una zona (ej: `us-central1-a`)

#### Configuración de Máquina:
- **Tipo de máquina**: 
  - Para desarrollo/pruebas: `Micro (1 vCPU, 0.6 GB RAM)` (db-f1-micro)
  - Para producción: `Small (1 vCPU, 1.7 GB RAM)` (db-g1-small) o superior

#### Configuración de Almacenamiento:
- **Tipo de almacenamiento**: `SSD`
- **Capacidad**: `20 GB` (mínimo recomendado)
- ✅ Marca **"Aumentar automáticamente el almacenamiento"**

#### Configuración de Conexión:
- **Redes autorizadas**: 
  - Para desarrollo: Puedes agregar `0.0.0.0/0` temporalmente (⚠️ NO recomendado para producción)
  - Para producción: Agrega solo las IPs necesarias o usa Private IP

#### Configuración de Copias de Seguridad:
- ✅ **Habilitar copias de seguridad automáticas**
- **Hora de inicio de la copia de seguridad**: `03:00` (3 AM)
- **Día de la semana**: Selecciona según prefieras

5. Haz clic en **"CREAR"**
6. ⏳ Espera 5-10 minutos mientras se crea la instancia

### 3.2 Crear Base de Datos

1. Una vez creada la instancia, haz clic en su nombre (`trabajoya-db`)
2. Ve a la pestaña **"BASES DE DATOS"**
3. Haz clic en **"CREAR BASE DE DATOS"**
4. Completa:
   - **Nombre de la base de datos**: `trabajoya`
5. Haz clic en **"CREAR"**

### 3.3 Crear Usuario de Base de Datos

1. En la misma página de la instancia, ve a la pestaña **"USUARIOS"**
2. Haz clic en **"AGREGAR CUENTA DE USUARIO"**
3. Completa:
   - **Tipo de usuario**: `Usuario de Cloud SQL`
   - **Nombre de usuario**: `trabajoya-user`
   - **Contraseña**: ⚠️ **Crea una contraseña segura y guárdala**
4. Haz clic en **"AGREGAR"**

### 3.4 Obtener IP de Conexión

1. En la página de la instancia, ve a la pestaña **"RESUMEN"**
2. Busca **"Dirección IP"** (público o privado según tu configuración)
3. ⚠️ **Copia esta IP** - la necesitarás para el connection string

**Ejemplo de Connection String:**
```
postgresql://trabajoya-user:TU_PASSWORD@TU_IP:5432/trabajoya?schema=public
```

---

## Paso 4: Crear Bucket de Almacenamiento (Cloud Storage)

1. Ve a **"Cloud Storage"** → **"Buckets"** en el menú lateral
2. Haz clic en **"CREAR"**
3. Completa la configuración:

#### Información del bucket:
- **Nombre del bucket**: `trabajoya-storage` (debe ser único globalmente)
- **Ubicación**: 
  - Tipo: `Región`
  - Región: `us-central1` (o la misma que tu base de datos)

#### Configuración predeterminada:
- **Clase de almacenamiento**: `Standard`
- **Control de acceso**: 
  - Para desarrollo: `Uniform` (acceso uniforme)
  - Para producción: `Fine-grained` (control granular)

#### Configuración de protección de datos:
- ✅ **Habilitar protección de eliminación de objetos** (recomendado)

4. Haz clic en **"CREAR"**

### 4.1 Configurar Permisos del Bucket

1. Haz clic en el bucket recién creado
2. Ve a la pestaña **"PERMISOS"**
3. Haz clic en **"AGREGAR PRINCIPAL"**
4. Completa:
   - **Nuevos principales**: 
     - Para desarrollo: `allUsers` (acceso público de lectura)
     - Para producción: Usa Service Account específico
   - **Rol**: `Storage Object Viewer` (para lectura pública)
5. Haz clic en **"GUARDAR"**

⚠️ **Nota**: Para producción, es mejor usar URLs firmadas en lugar de acceso público.

---

## Paso 5: Configurar Secret Manager

Secret Manager almacenará tus variables de entorno sensibles de forma segura.

### 5.1 Crear Secrets

Ve a **"Secret Manager"** en el menú lateral y crea los siguientes secrets:

#### a) DATABASE_URL

1. Haz clic en **"CREAR SECRETO"**
2. Completa:
   - **Nombre**: `DATABASE_URL`
   - **Valor del secreto**: Pega tu connection string
     ```
     postgresql://trabajoya-user:TU_PASSWORD@TU_IP:5432/trabajoya?schema=public
     ```
3. Haz clic en **"CREAR SECRETO"**

#### b) JWT_ACCESS_SECRET

1. Haz clic en **"CREAR SECRETO"**
2. Completa:
   - **Nombre**: `JWT_ACCESS_SECRET`
   - **Valor del secreto**: Tu secret de JWT para access tokens
3. Haz clic en **"CREAR SECRETO"**

#### c) JWT_REFRESH_SECRET

1. Haz clic en **"CREAR SECRETO"**
2. Completa:
   - **Nombre**: `JWT_REFRESH_SECRET`
   - **Valor del secreto**: Tu secret de JWT para refresh tokens
3. Haz clic en **"CREAR SECRETO"**

#### d) GCS_BUCKET_NAME

1. Haz clic en **"CREAR SECRETO"**
2. Completa:
   - **Nombre**: `GCS_BUCKET_NAME`
   - **Valor del secreto**: `trabajoya-storage` (o el nombre de tu bucket)
3. Haz clic en **"CREAR SECRETO"**

#### e) GCP_PROJECT_ID

1. Haz clic en **"CREAR SECRETO"**
2. Completa:
   - **Nombre**: `GCP_PROJECT_ID`
   - **Valor del secreto**: El ID de tu proyecto (lo puedes ver en la parte superior de la consola)
3. Haz clic en **"CREAR SECRETO"**

#### f) Otros Secrets Necesarios

Crea también estos secrets si los usas:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- Cualquier otro secret que uses en tu aplicación

---

## Paso 6: Desplegar Backend en Cloud Run

### 6.1 Preparar el Código

Asegúrate de tener tu código en un repositorio Git (GitHub, GitLab, etc.) o prepara los archivos localmente.

### 6.2 Desplegar desde la Consola

1. Ve a **"Cloud Run"** en el menú lateral
2. Haz clic en **"CREAR SERVICIO"**

#### Configuración Básica:
- **Nombre del servicio**: `trabajoya-backend`
- **Región**: `us-central1` (o la misma que tu base de datos)
- **Autenticación**: 
  - ✅ **Permitir tráfico no autenticado** (si quieres acceso público)
  - O configura autenticación según tus necesidades

#### Configuración del Contenedor:

**Imagen del contenedor:**
- Si ya tienes una imagen en Container Registry:
  - Haz clic en **"SELECCIONAR"** y elige tu imagen
- Si vas a construir desde código:
  - Ve a la pestaña **"CONTINUOUS DEPLOYMENT"** (ver paso 8)
  - O construye la imagen primero con Cloud Build

**Puerto:**
- **Puerto del contenedor**: `8080`
- **Nombre de la variable de entorno del puerto**: `PORT`

**Variables de entorno:**
Haz clic en **"AGREGAR VARIABLE"** y agrega:
- `NODE_ENV` = `production`
- `PORT` = `8080`
- `ALLOWED_ORIGINS` = `https://tu-frontend.com` (ajusta según necesites)

**Secrets:**
Haz clic en **"AGREGAR SECRET"** y agrega cada secret:
- **Nombre de la variable**: `DATABASE_URL`
- **Secret**: Selecciona `DATABASE_URL` de la lista
- **Versión**: `latest`

Repite para:
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GCS_BUCKET_NAME`
- `GCP_PROJECT_ID`
- Cualquier otro secret que necesites

#### Configuración de Ejecución:

**CPU asignada:**
- **CPU**: `2` (recomendado para WebSockets)

**Memoria:**
- **Memoria**: `2 Gi` (recomendado para WebSockets)

**Tiempo de espera:**
- **Tiempo de espera de solicitud**: `300` segundos (⚠️ **CRÍTICO para WebSockets**)

**Capacidad:**
- **Número mínimo de instancias**: `1` (⚠️ **CRÍTICO para WebSockets**)
- **Número máximo de instancias**: `10` (ajusta según necesites)
- **Concurrencia**: `80` (número de solicitudes por instancia)

3. Haz clic en **"CREAR"** o **"NEXT"** (si hay más pasos)
4. ⏳ Espera 2-5 minutos mientras se despliega

### 6.3 Obtener URL del Servicio

Una vez desplegado:
1. Haz clic en el servicio `trabajoya-backend`
2. En la parte superior verás la **URL del servicio**
3. ⚠️ **Copia esta URL** - la necesitarás para configurar el frontend

Ejemplo: `https://trabajoya-backend-xxxxx-uc.a.run.app`

---

## Paso 7: Configurar WebSockets (CRÍTICO)

⚠️ **ESTE PASO ES CRÍTICO** para que mensajes y llamadas funcionen correctamente.

### 7.1 Verificar Configuración Actual

1. Ve a **"Cloud Run"** → Selecciona `trabajoya-backend`
2. Haz clic en **"EDITAR Y DESPLEGAR NUEVA REVISIÓN"**

### 7.2 Configuraciones Críticas

En la sección **"Configuración de ejecución"**:

#### ✅ Número mínimo de instancias = 1
- **Número mínimo de instancias**: `1`
- ⚠️ **Esto es CRÍTICO** - mantiene conexiones WebSocket activas

#### ✅ Tiempo de espera = 300 segundos
- **Tiempo de espera de solicitud**: `300` (máximo permitido)
- ⚠️ **Necesario** para conexiones WebSocket largas

#### ✅ Memoria y CPU suficientes
- **CPU**: `2` o más
- **Memoria**: `2 Gi` o más
- Necesario para manejar múltiples conexiones simultáneas

#### ✅ Concurrencia apropiada
- **Concurrencia**: `80` (ajusta según necesites)
- Controla cuántas solicitudes simultáneas puede manejar cada instancia

### 7.3 Guardar Cambios

1. Haz clic en **"DESPLEGAR"**
2. ⏳ Espera a que se despliegue la nueva revisión

### 7.4 Verificar Configuración

1. Después del despliegue, verifica que:
   - ✅ Min instances = 1
   - ✅ Timeout = 300
   - ✅ Memory >= 2Gi
   - ✅ CPU >= 2

---

## Paso 8: Configurar CI/CD con Cloud Build

### 8.1 Conectar Repositorio

1. Ve a **"Cloud Build"** → **"Triggers"** en el menú lateral
2. Haz clic en **"CREAR TRIGGER"**
3. Completa:

#### Configuración del Trigger:
- **Nombre**: `trabajoya-backend-deploy`
- **Descripción**: `Deploy automático del backend`

#### Evento:
- **Tipo de evento**: `Push a una rama`
- **Rama**: `^main$` (o la rama que uses)
- **Repositorio**: 
  - Si es la primera vez, haz clic en **"CONECTAR REPOSITORIO"**
  - Selecciona tu proveedor (GitHub, GitLab, etc.)
  - Autoriza y selecciona tu repositorio

#### Configuración:
- **Tipo**: `Archivo de configuración de Cloud Build (yaml o json)`
- **Ubicación**: `Backend/cloudbuild.yaml`

4. Haz clic en **"CREAR"**

### 8.2 Verificar Trigger

1. Haz un push a tu rama `main`
2. Ve a **"Cloud Build"** → **"Historial"**
3. Deberías ver un build iniciándose automáticamente
4. El build:
   - Construirá la imagen Docker
   - La subirá a Container Registry
   - Desplegará en Cloud Run

---

## Paso 9: Verificar Funcionamiento

### 9.1 Verificar Servicio

1. Ve a **"Cloud Run"** → `trabajoya-backend`
2. Haz clic en la **URL del servicio** para abrirla en el navegador
3. Deberías ver una respuesta (o error si no hay endpoint raíz, lo cual es normal)

### 9.2 Verificar Logs

1. En la página del servicio, ve a la pestaña **"LOGS"**
2. Verifica que no haya errores críticos
3. Busca mensajes como:
   - ✅ `Application is running on: http://localhost:8080`
   - ✅ `Messages Gateway initialized`
   - ✅ `Calls Gateway initialized`

### 9.3 Probar WebSockets

#### Test de Mensajes:
```javascript
// En la consola del navegador o Postman
const socket = io('TU_URL_AQUI/messages', {
  auth: { token: 'TU_JWT_TOKEN' }
});

socket.on('connected', () => {
  console.log('✅ Conectado al servicio de mensajes');
});
```

#### Test de Llamadas:
```javascript
const callsSocket = io('TU_URL_AQUI/calls', {
  auth: { token: 'TU_JWT_TOKEN' }
});

callsSocket.on('connected', () => {
  console.log('✅ Conectado al servicio de llamadas');
});
```

### 9.4 Verificar Base de Datos

1. Ve a **"SQL"** → `trabajoya-db`
2. Haz clic en **"ABRIR CLOUD SHELL"** (icono de terminal en la parte superior)
3. Ejecuta:
```bash
gcloud sql connect trabajoya-db --user=trabajoya-user --database=trabajoya
```
4. Ejecuta una consulta de prueba:
```sql
SELECT version();
```

### 9.5 Verificar Almacenamiento

1. Ve a **"Cloud Storage"** → `trabajoya-storage`
2. Deberías poder ver el bucket vacío (o con archivos si ya migraste)
3. Prueba subir un archivo de prueba

---

## Troubleshooting

### ❌ WebSockets No Funcionan

**Síntomas:**
- Las conexiones se desconectan inmediatamente
- No se reciben mensajes en tiempo real

**Solución:**
1. Verifica que **Min instances = 1** en Cloud Run
2. Verifica que **Timeout = 300** segundos
3. Revisa los logs en Cloud Run para ver errores
4. Verifica que el frontend está usando la URL correcta

### ❌ Error de Conexión a Base de Datos

**Síntomas:**
- Errores de conexión en los logs
- La aplicación no puede conectarse a PostgreSQL

**Solución:**
1. Verifica que el secret `DATABASE_URL` está correcto
2. Verifica que Cloud Run tiene acceso a Cloud SQL:
   - Ve a Cloud SQL → `trabajoya-db` → **"CONEXIONES"**
   - Asegúrate de que Cloud Run está autorizado
3. Verifica que la IP de Cloud SQL está permitida en las redes autorizadas

### ❌ Error de Almacenamiento

**Síntomas:**
- No se pueden subir archivos
- Errores de permisos en Cloud Storage

**Solución:**
1. Verifica que el secret `GCS_BUCKET_NAME` está correcto
2. Verifica los permisos del Service Account:
   - Ve a **"IAM y administración"** → **"IAM"**
   - Busca el Service Account de Cloud Run
   - Asegúrate de que tiene rol `Storage Object Admin`
3. Verifica que el bucket existe y tiene los permisos correctos

### ❌ La Aplicación No Inicia

**Síntomas:**
- El servicio muestra errores
- No responde a las solicitudes

**Solución:**
1. Revisa los logs en Cloud Run
2. Verifica que todos los secrets están configurados
3. Verifica que el puerto es `8080`
4. Verifica que la imagen Docker se construyó correctamente

### ❌ Build Falla en Cloud Build

**Síntomas:**
- El trigger de Cloud Build falla
- Errores en la construcción de la imagen

**Solución:**
1. Ve a **"Cloud Build"** → **"Historial"**
2. Haz clic en el build fallido para ver los logs
3. Verifica que el archivo `cloudbuild.yaml` está en la ruta correcta
4. Verifica que el Dockerfile existe y es correcto

---

## ✅ Checklist Final

Antes de considerar la migración completa, verifica:

### Infraestructura
- [ ] Proyecto de Google Cloud creado
- [ ] Todas las APIs habilitadas
- [ ] Base de datos Cloud SQL creada y configurada
- [ ] Bucket de Cloud Storage creado
- [ ] Todos los secrets configurados en Secret Manager

### Despliegue
- [ ] Servicio desplegado en Cloud Run
- [ ] Min instances = 1 configurado
- [ ] Timeout = 300 configurado
- [ ] Memory y CPU suficientes
- [ ] Variables de entorno configuradas
- [ ] Secrets vinculados correctamente

### Funcionalidad
- [ ] API REST responde correctamente
- [ ] WebSockets de mensajes funcionan
- [ ] WebSockets de llamadas funcionan
- [ ] Base de datos accesible
- [ ] Almacenamiento funciona
- [ ] Logs sin errores críticos

### CI/CD
- [ ] Trigger de Cloud Build configurado
- [ ] Build automático funciona
- [ ] Deploy automático funciona

---

## 📞 Soporte Adicional

- **Documentación oficial**: [cloud.google.com/docs](https://cloud.google.com/docs)
- **Cloud Run**: [cloud.google.com/run/docs](https://cloud.google.com/run/docs)
- **WebSockets en Cloud Run**: [cloud.google.com/run/docs/triggering/websockets](https://cloud.google.com/run/docs/triggering/websockets)
- **Cloud SQL**: [cloud.google.com/sql/docs](https://cloud.google.com/sql/docs)
- **Cloud Storage**: [cloud.google.com/storage/docs](https://cloud.google.com/storage/docs)

---

## 🎉 ¡Migración Completada!

Una vez que hayas completado todos los pasos y verificado el funcionamiento, tu backend estará completamente migrado a Google Cloud Platform con soporte completo para mensajes y llamadas en tiempo real.

**Próximos pasos sugeridos:**
1. Configurar Cloud CDN para optimizar la entrega de archivos
2. Configurar alertas y monitoreo
3. Configurar backups automáticos de la base de datos
4. Optimizar costos según uso

