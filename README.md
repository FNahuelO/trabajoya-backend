# TrabajoYa Backend

## 🚀 Desarrollo

### Opción 1: Desarrollo local (recomendado)

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Ejecutar migraciones
npm run prisma:deploy

# Generar cliente de Prisma
npm run prisma:generate

# Iniciar en modo desarrollo con watch
npm run dev
```

### Opción 2: Desarrollo con Docker

```bash
# Iniciar servicios de desarrollo
npm run docker:dev

# Detener servicios
npm run docker:down
```

## 🏭 Producción

### Opción 1: Producción local

```bash
# Instalar dependencias de producción
npm ci --only=production

# Compilar aplicación
npm run build

# Ejecutar migraciones
npm run prisma:deploy

# Iniciar aplicación
npm run start:prod
```

### Opción 2: Producción con Docker

```bash
# Iniciar servicios de producción
npm run docker:prod

# Detener servicios
npm run docker:down:prod
```

## 📋 Scripts Disponibles

- `npm run dev` - Desarrollo con watch mode
- `npm run build` - Compilar para producción
- `npm run start:prod` - Ejecutar versión compilada
- `npm run docker:dev` - Desarrollo con Docker
- `npm run docker:prod` - Producción con Docker
- `npm run prisma:generate` - Generar cliente de Prisma
- `npm run prisma:deploy` - Ejecutar migraciones
- `npm run prisma:seed` - Poblar base de datos

## 🔧 Configuración

### Variables de Entorno

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5444/trabajoya"
JWT_ACCESS_SECRET="your-secret"
JWT_REFRESH_TTL="2592000"
JWT_ACCESS_TTL="900"
GOOGLE_CLIENT_ID="your-google-client-id"
APPLE_CLIENT_ID="your-apple-client-id"
```

### Base de Datos

- **Desarrollo**: PostgreSQL en puerto 5444
- **API**: NestJS en puerto 4000
- **Watch mode**: Recarga automática en cambios de código
