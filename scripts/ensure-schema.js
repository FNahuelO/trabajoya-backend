/**
 * Script para asegurar que el esquema de la base de datos esté aplicado
 * Verifica si las tablas existen y las crea si no existen
 */

const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

const prisma = new PrismaClient();

async function checkTablesExist() {
  try {
    // Verificar si la tabla User existe usando SQL directo
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'User'
      ) as exists;
    `;
    
    return result[0]?.exists || false;
  } catch (error) {
    console.error("Error verificando si las tablas existen:", error);
    return false;
  }
}

async function ensureSchema() {
  console.log("🔍 Verificando si el esquema de la base de datos existe...");
  
  const tablesExist = await checkTablesExist();
  
  if (tablesExist) {
    console.log("✅ Las tablas ya existen. El esquema está aplicado.");
    return true;
  }
  
  console.log("⚠️  Las tablas no existen. Aplicando esquema...");
  
  try {
    // Si las tablas no existen, usar db push directamente
    // Esto sincronizará el esquema con la base de datos sin depender del estado de migraciones
    console.log("📦 Sincronizando esquema con db push...");
    execSync("npx prisma db push --accept-data-loss --skip-generate", { 
      stdio: "inherit",
      env: process.env 
    });
    
    // Verificar nuevamente si las tablas existen
    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar un segundo para que se completen las operaciones
    
    const tablesExistAfter = await checkTablesExist();
    if (tablesExistAfter) {
      console.log("✅ Esquema sincronizado correctamente. Las tablas ahora existen.");
      return true;
    } else {
      console.error("❌ Las tablas aún no existen después de db push.");
      // Intentar una vez más con migrate deploy
      console.log("📦 Intentando migrate deploy como último recurso...");
      try {
        execSync("npx prisma migrate deploy", { 
          stdio: "inherit",
          env: process.env 
        });
        const tablesExistAfterMigrate = await checkTablesExist();
        if (tablesExistAfterMigrate) {
          console.log("✅ Migraciones aplicadas correctamente.");
          return true;
        }
      } catch (migrateError) {
        console.error("❌ migrate deploy también falló:", migrateError.message);
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Error al aplicar esquema:", error);
    return false;
  }
}

async function main() {
  try {
    const success = await ensureSchema();
    
    if (!success) {
      console.error("❌ No se pudo asegurar que el esquema esté aplicado.");
      process.exit(1);
    }
    
    console.log("✅ Esquema verificado y aplicado correctamente.");
  } catch (error) {
    console.error("❌ Error fatal en ensure-schema:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

