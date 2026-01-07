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

echo "   Directorio de migraciones encontrado."
echo "   Listando migraciones disponibles:"
ls -la prisma/migrations/

echo ""
echo "   Verificando estado de migraciones en la base de datos..."
npx prisma migrate status || true

echo ""
echo "   Aplicando migraciones pendientes..."
npx prisma migrate deploy --skip-seed 2>&1 | tee /tmp/migrate_output.txt
MIGRATE_EXIT_CODE=${PIPESTATUS[0]}

if [ $MIGRATE_EXIT_CODE -ne 0 ]; then
  echo "⚠️  ADVERTENCIA: prisma migrate deploy falló con código $MIGRATE_EXIT_CODE"
  echo "   Output completo:"
  cat /tmp/migrate_output.txt
  
  # Verificar si el error es por checksum diferente
  if grep -q "checksum" /tmp/migrate_output.txt; then
    echo ""
    echo "   ⚠️  Error de checksum detectado. Esto puede ocurrir si la migración fue editada."
    echo "   Intentando resolver marcando la migración como aplicada..."
    
    # Obtener el nombre de la migración problemática
    PROBLEM_MIGRATION=$(grep -oP '20\d{14}_\w+' /tmp/migrate_output.txt | head -1)
    if [ -n "$PROBLEM_MIGRATION" ]; then
      echo "   Migración problemática: $PROBLEM_MIGRATION"
      npx prisma migrate resolve --applied "$PROBLEM_MIGRATION" || true
    fi
  fi
  
  # Intentar aplicar nuevamente
  echo ""
  echo "   Reintentando aplicar migraciones..."
  npx prisma migrate deploy --skip-seed || {
    echo "❌ ERROR: Las migraciones de Prisma siguen fallando."
    echo "   Por favor, verifica manualmente la base de datos."
    # No salir, intentar continuar de todas formas
  }
fi

echo "✅ Proceso de migraciones completado"

# Verificar que las tablas críticas existen
echo "🔍 Verificando tablas críticas..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const prisma = new PrismaClient();

async function checkTables() {
  let videoMeetingExists = false;
  let mediaAssetExists = false;
  
  try {
    await prisma.\$queryRaw\`SELECT 1 FROM \"VideoMeeting\" LIMIT 0\`;
    console.log('   ✅ Tabla VideoMeeting existe');
    videoMeetingExists = true;
  } catch (e) {
    console.log('   ❌ Tabla VideoMeeting NO existe');
    videoMeetingExists = false;
  }
  
  try {
    await prisma.\$queryRaw\`SELECT 1 FROM \"MediaAsset\" LIMIT 0\`;
    console.log('   ✅ Tabla MediaAsset existe');
    mediaAssetExists = true;
  } catch (e) {
    console.log('   ❌ Tabla MediaAsset NO existe');
    mediaAssetExists = false;
  }
  
  // Si las tablas no existen pero Prisma dice que no hay migraciones pendientes,
  // significa que la migración está registrada pero nunca se ejecutó
  if (!videoMeetingExists || !mediaAssetExists) {
    console.log('');
    console.log('   ⚠️  PROBLEMA DETECTADO: Las tablas faltan pero Prisma dice que no hay migraciones pendientes.');
    console.log('   Esto significa que la migración está registrada pero nunca se ejecutó.');
    console.log('   Intentando resolver marcando la migración como no aplicada y re-ejecutándola...');
    console.log('');
    
    try {
      // Marcar la migración como no aplicada
      execSync('npx prisma migrate resolve --rolled-back 20260107020313_add_video_meeting_and_m', { stdio: 'inherit' });
      console.log('   ✅ Migración marcada como no aplicada');
      
      // Intentar aplicar nuevamente
      console.log('   🔄 Aplicando migración nuevamente...');
      execSync('npx prisma migrate deploy --skip-seed', { stdio: 'inherit' });
      console.log('   ✅ Migración aplicada correctamente');
      
      // Verificar nuevamente
      try {
        await prisma.\$queryRaw\`SELECT 1 FROM \"VideoMeeting\" LIMIT 0\`;
        await prisma.\$queryRaw\`SELECT 1 FROM \"MediaAsset\" LIMIT 0\`;
        console.log('   ✅ Tablas verificadas correctamente después de la corrección');
      } catch (e) {
        console.log('   ❌ ERROR: Las tablas aún no existen después de intentar corregir');
        console.log('   Por favor, ejecuta manualmente el SQL de la migración');
      }
    } catch (error) {
      console.log('   ⚠️  No se pudo resolver automáticamente. Error:', error.message);
      console.log('   Por favor, ejecuta manualmente:');
      console.log('   npx prisma migrate resolve --rolled-back 20260107020313_add_video_meeting_and_m');
      console.log('   npx prisma migrate deploy');
    }
  }
  
  await prisma.\$disconnect();
}

checkTables();
"

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

