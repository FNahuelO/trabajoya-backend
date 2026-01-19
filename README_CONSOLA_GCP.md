# Migración a Google Cloud - Guía de Consola Web

Esta es la guía **paso a paso** para migrar el backend a Google Cloud usando **solo la consola web** (console.cloud.google.com), sin necesidad de usar comandos de terminal.

## 🚀 Inicio Rápido

1. **Abre la consola**: [console.cloud.google.com](https://console.cloud.google.com)
2. **Sigue la guía completa**: Abre `docs/MIGRACION_GCP_CONSOLA.md`
3. **Sigue los pasos en orden**: Cada paso está detallado con capturas de pantalla conceptuales

## 📋 Pasos Principales

### 1️⃣ **Crear Proyecto** (2 minutos)
- Crear nuevo proyecto en Google Cloud
- Habilitar facturación

### 2️⃣ **Habilitar APIs** (5 minutos)
- Cloud Run API
- Cloud SQL Admin API
- Cloud Storage API
- Cloud Build API
- Secret Manager API

### 3️⃣ **Crear Base de Datos** (10-15 minutos)
- Crear instancia Cloud SQL (PostgreSQL)
- Crear base de datos `trabajoya`
- Crear usuario `trabajoya-user`
- Obtener IP de conexión

### 4️⃣ **Crear Almacenamiento** (5 minutos)
- Crear bucket `trabajoya-storage`
- Configurar permisos

### 5️⃣ **Configurar Secrets** (10 minutos)
- Crear secrets en Secret Manager:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `GCS_BUCKET_NAME`
  - `GCP_PROJECT_ID`

### 6️⃣ **Desplegar Backend** (15-20 minutos)
- Crear servicio en Cloud Run
- Configurar imagen del contenedor
- Vincular secrets
- Configurar variables de entorno

### 7️⃣ **Configurar WebSockets** ⚠️ **CRÍTICO** (5 minutos)
- Min instances = 1
- Timeout = 300 segundos
- Memory = 2Gi, CPU = 2

### 8️⃣ **Configurar CI/CD** (10 minutos)
- Conectar repositorio
- Crear trigger de Cloud Build
- Configurar deploy automático

### 9️⃣ **Verificar** (10 minutos)
- Probar API REST
- Probar WebSockets de mensajes
- Probar WebSockets de llamadas
- Verificar logs

## ⚠️ Configuraciones Críticas para WebSockets

Para que **mensajes y llamadas funcionen perfectamente**, estas configuraciones son **OBLIGATORIAS**:

| Configuración | Valor | Dónde Configurarlo |
|--------------|-------|-------------------|
| **Min Instances** | `1` | Cloud Run → Configuración de ejecución |
| **Timeout** | `300` segundos | Cloud Run → Tiempo de espera |
| **Memory** | `2 Gi` o más | Cloud Run → Configuración de ejecución |
| **CPU** | `2` o más | Cloud Run → Configuración de ejecución |

## 📚 Documentación Completa

**Guía detallada paso a paso**: `docs/MIGRACION_GCP_CONSOLA.md`

Esta guía incluye:
- ✅ Instrucciones detalladas para cada paso
- ✅ Dónde hacer clic en la consola
- ✅ Qué valores ingresar
- ✅ Screenshots conceptuales
- ✅ Troubleshooting común
- ✅ Checklist final

## 🎯 Tiempo Estimado Total

- **Primera vez**: 1-2 horas (dependiendo de la velocidad de creación de recursos)
- **Si ya tienes experiencia**: 30-45 minutos

## 💡 Tips Importantes

1. **Guarda todas las contraseñas** en un lugar seguro
2. **Copia las URLs y connection strings** cuando se generen
3. **Verifica cada paso** antes de continuar al siguiente
4. **Revisa los logs** si algo no funciona
5. **La configuración de WebSockets es crítica** - no la omitas

## 🐛 Problemas Comunes

### WebSockets no funcionan
→ Verifica Min Instances = 1 y Timeout = 300

### Error de conexión a base de datos
→ Verifica el secret DATABASE_URL y los permisos de Cloud SQL

### Error de almacenamiento
→ Verifica permisos del Service Account y el secret GCS_BUCKET_NAME

### La aplicación no inicia
→ Revisa los logs en Cloud Run para ver el error específico

## ✅ Checklist Rápido

Antes de terminar, verifica:

- [ ] Proyecto creado
- [ ] APIs habilitadas
- [ ] Base de datos creada
- [ ] Bucket creado
- [ ] Secrets configurados
- [ ] Servicio desplegado
- [ ] **Min instances = 1** ⚠️
- [ ] **Timeout = 300** ⚠️
- [ ] WebSockets funcionan
- [ ] Logs sin errores

## 📞 Ayuda

Si tienes problemas:
1. Revisa la sección de Troubleshooting en la guía completa
2. Revisa los logs en Cloud Run
3. Verifica que todos los secrets están correctos
4. Consulta la documentación oficial de Google Cloud

---

**¡Sigue la guía paso a paso y tu backend estará migrado en menos de 2 horas!** 🚀

