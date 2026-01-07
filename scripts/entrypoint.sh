#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."

# Esperar a que la base de datos esté disponible
echo "⏳ Esperando a que la base de datos esté disponible..."
node scripts/wait-for-db.js

# Ejecutar migraciones (CRÍTICO: debe fallar si hay error)
echo "📦 Ejecutando migraciones de Prisma..."
echo "   Verificando conexión a la base de datos..."
echo "   DATABASE_URL: ${DATABASE_URL:0:50}..." # Mostrar solo primeros 50 caracteres por seguridad

# Verificar que el directorio de migraciones existe
if [ ! -d "prisma/migrations" ]; then
  echo "❌ ERROR: El directorio prisma/migrations no existe."
  echo "   Listando contenido de prisma/:"
  ls -la prisma/ || true
  exit 1
fi

echo "   Directorio de migraciones encontrado. Aplicando migraciones..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Las migraciones de Prisma fallaron. No se puede continuar."
  echo "   Por favor, verifica:"
  echo "   1. La conexión a la base de datos"
  echo "   2. Los permisos de la base de datos"
  echo "   3. Que el esquema de Prisma esté actualizado"
  exit 1
fi

echo "✅ Migraciones aplicadas correctamente"

# Ejecutar seed solo si la base de datos está vacía (no se ha creado antes)
echo "🌱 Verificando si se necesita ejecutar seed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkAndSeed() {
  try {
    // Verificar si hay usuarios en la base de datos
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      console.log('📝 Base de datos vacía detectada, ejecutando seed inicial...');
      console.log('   (El seed solo se ejecuta si la base de datos no ha sido creada antes)');
      try {
        // Usar el script seed-if-empty.ts que tiene su propia verificación adicional
        // Intentar ejecutar el seed compilado primero
        if (fs.existsSync('/app/dist/prisma/seed-if-empty.js')) {
          console.log('   Usando seed compilado...');
          execSync('node dist/prisma/seed-if-empty.js', { stdio: 'inherit' });
        } else {
          // Si no está compilado, intentar con ts-node
          console.log('   Usando ts-node para ejecutar seed...');
          execSync('npx ts-node --transpile-only prisma/seed-if-empty.ts', { stdio: 'inherit' });
        }
        console.log('✅ Seed ejecutado correctamente');
      } catch (seedError) {
        console.log('⚠️  No se pudo ejecutar seed. Continuando sin seed...');
        console.log('   Error:', seedError.message);
      }
    } else {
      console.log('✅ Base de datos ya contiene datos (usuarios encontrados: ' + userCount + ')');
      console.log('   Saltando seed - solo se ejecuta cuando la base de datos está completamente vacía');
    }
  } catch (error) {
    console.error('❌ Error verificando/ejecutando seed:', error.message);
    // No fallar si el seed falla, solo continuar
  } finally {
    await prisma.\$disconnect();
  }
}

checkAndSeed();
"

# Iniciar la aplicación
echo "🎯 Iniciando aplicación NestJS..."
exec node dist/main.js

