#!/bin/sh
set -e

echo "🚀 Iniciando aplicación en producción..."

# Esperar a que la base de datos esté disponible
echo "⏳ Esperando a que la base de datos esté disponible..."
node scripts/wait-for-db.js

# Ejecutar migraciones
echo "📦 Ejecutando migraciones de Prisma..."
npx prisma migrate deploy || {
  echo "⚠️  Advertencia: Las migraciones pueden haber fallado o ya estar aplicadas"
}

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

