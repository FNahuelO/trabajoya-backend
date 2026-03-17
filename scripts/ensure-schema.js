/**
 * Script para asegurar que el esquema de la base de datos esté aplicado
 * Verifica si las tablas existen y las crea si no existen
 */

const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

const prisma = new PrismaClient();
const PRISMA_CMD = "npm exec -- prisma";

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

async function checkUserPromotionExists() {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'UserPromotion'
      ) as exists;
    `;
    
    return result[0]?.exists || false;
  } catch (error) {
    console.error("Error verificando si UserPromotion existe:", error);
    return false;
  }
}

async function ensureSchema() {
  console.log("🔍 Verificando si el esquema de la base de datos existe...");
  
  const tablesExist = await checkTablesExist();
  
  if (!tablesExist) {
    console.log("⚠️  Las tablas base no existen. Aplicando esquema...");
    
    try {
      // Si las tablas no existen, usar db push directamente
      console.log("📦 Sincronizando esquema con db push...");
      execSync(`${PRISMA_CMD} db push --accept-data-loss --skip-generate`, {
        stdio: "inherit",
        env: process.env 
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const tablesExistAfter = await checkTablesExist();
      if (tablesExistAfter) {
        console.log("✅ Esquema sincronizado correctamente.");
        return true;
      } else {
        console.error("❌ Las tablas aún no existen después de db push.");
        return false;
      }
    } catch (error) {
      console.error("❌ Error al aplicar esquema:", error);
      return false;
    }
  }
  
  // Si las tablas base existen, verificar si hay migraciones pendientes
  console.log("✅ Las tablas base existen. Verificando migraciones pendientes...");
  
  try {
    // Verificar si la tabla UserPromotion existe (tabla nueva que puede faltar)
    const userPromotionExists = await checkUserPromotionExists();
    
    if (!userPromotionExists) {
      console.log("⚠️  La tabla UserPromotion no existe. Aplicando migraciones pendientes...");
      
      // Ejecutar migrate deploy para aplicar migraciones pendientes
      console.log("📦 Aplicando migraciones con migrate deploy...");
      execSync(`${PRISMA_CMD} migrate deploy`, {
        stdio: "inherit",
        env: process.env 
      });
      
      // Verificar nuevamente
      await new Promise(resolve => setTimeout(resolve, 1000));
      const userPromotionExistsAfter = await checkUserPromotionExists();
      
      if (userPromotionExistsAfter) {
        console.log("✅ Migraciones aplicadas correctamente.");
        return true;
      } else {
        // Si migrate deploy no funcionó, intentar db push como fallback
        console.log("⚠️  migrate deploy no creó la tabla. Intentando db push...");
        execSync(`${PRISMA_CMD} db push --accept-data-loss --skip-generate`, {
          stdio: "inherit",
          env: process.env 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        const userPromotionExistsAfterPush = await checkUserPromotionExists();
        
        if (userPromotionExistsAfterPush) {
          console.log("✅ Esquema sincronizado con db push.");
          return true;
        } else {
          console.error("❌ No se pudo crear la tabla UserPromotion.");
          return false;
        }
      }
    } else {
      console.log("✅ Todas las tablas necesarias existen.");
      // Aún así, ejecutar migrate deploy para asegurar que no hay migraciones pendientes
      try {
        console.log("📦 Verificando migraciones pendientes...");
        execSync(`${PRISMA_CMD} migrate deploy`, {
          stdio: "inherit",
          env: process.env 
        });
        console.log("✅ Migraciones verificadas/aplicadas.");
      } catch (migrateError) {
        // Si migrate deploy falla pero las tablas existen, continuar
        console.log("⚠️  No se pudieron verificar migraciones, pero las tablas existen. Continuando...");
      }
      return true;
    }
  } catch (error) {
    console.error("❌ Error al verificar/aplicar migraciones:", error);
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

