FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache openssl libc6-compat

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

# Compilar aplicación
RUN npm run build

# Exponer puerto
EXPOSE 4000

# Copiar y hacer ejecutables los scripts
COPY scripts/resolve-failed-migrations.sh ./scripts/
COPY scripts/migrate-deploy.sh ./scripts/
COPY scripts/start.sh ./scripts/
COPY scripts/seed-if-empty.js ./scripts/
COPY scripts/ensure-schema.js ./scripts/
RUN chmod +x ./scripts/resolve-failed-migrations.sh ./scripts/migrate-deploy.sh ./scripts/start.sh

# Instalar postgresql-client para usar psql
RUN apk add --no-cache postgresql-client

# Comando de inicio - usar start.sh que incluye todo el flujo
CMD ["sh", "-c", "./scripts/start.sh"]

