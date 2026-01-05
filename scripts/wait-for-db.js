#!/usr/bin/env node

/**
 * Script para verificar que la base de datos esté disponible antes de ejecutar migraciones
 * Reintenta la conexión hasta que sea exitosa o se agoten los intentos
 */

const { PrismaClient } = require('@prisma/client');

const MAX_RETRIES = 30;
const RETRY_DELAY = 2000; // 2 segundos

const prisma = new PrismaClient({
  log: ['error'],
});

async function waitForDatabase() {
  console.log('🔍 Verificando conexión a la base de datos...');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Intenta ejecutar una consulta simple para verificar la conexión
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Base de datos disponible y conectada correctamente');
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`❌ Error: No se pudo conectar a la base de datos después de ${MAX_RETRIES} intentos`);
        console.error(`Error final: ${error.message}`);
        await prisma.$disconnect();
        process.exit(1);
      }
      
      console.log(`⏳ Intento ${attempt}/${MAX_RETRIES} - Base de datos no disponible todavía. Reintentando en ${RETRY_DELAY/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

waitForDatabase();

