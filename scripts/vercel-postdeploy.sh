#!/bin/bash
# Script para ejecutar después del deploy en Vercel
# Uso: npx vercel env pull && npm run prisma:deploy && npm run prisma:seed-if-empty

echo "🚀 Ejecutando migraciones y seed en Vercel..."

# Ejecutar migraciones
echo "📦 Ejecutando migraciones..."
npm run prisma:deploy

# Ejecutar seed si la base de datos está vacía
echo "🌱 Ejecutando seed si la base de datos está vacía..."
npm run prisma:seed-if-empty

echo "✅ Post-deploy completado!"

