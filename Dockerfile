FROM node:20-alpine AS base

# Instalar OpenSSL y otras dependencias necesarias para Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "-c", "npm run dev"]
