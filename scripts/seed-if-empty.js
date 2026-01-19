/**
 * Script para ejecutar seed verificando cada tabla individualmente
 * Verifica cada tabla antes de ejecutar su seed correspondiente
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Catálogos que se siembran en seed.ts
const CATALOG_TYPES = [
  "JOB_AREA",
  "JOB_TYPE",
  "JOB_LEVEL",
  "MODALITIES",
  "JOB_TYPES",
  "EXPERIENCE_LEVELS",
  "APPLICATION_STATUSES",
  "LANGUAGE_LEVELS",
  "COMPANY_SIZES",
  "SECTORS",
  "STUDY_TYPES",
  "STUDY_STATUSES",
  "MARITAL_STATUSES",
];

// Planes que se siembran
const PLAN_CODES = ["LAUNCH_TRIAL", "URGENT", "STANDARD", "CRYSTAL"];

async function checkTablesExist() {
  try {
    // Intentar conectar primero con una consulta simple
    await prisma.$connect();
    
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
    // Detectar si es un error de conexión
    const errorMessage = error.message || error.toString();
    const isConnectionError = 
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes("not reachable") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("ECONNREFUSED") ||
      error.code === "P1001" || // Prisma connection error
      error.code === "P1017";   // Prisma server closed connection
    
    if (isConnectionError) {
      console.error("❌ Error de conexión a la base de datos:", errorMessage);
      console.error("⚠️  Asegúrate de que:");
      console.error("   - La instancia de Cloud SQL está configurada en Cloud Run");
      console.error("   - El Cloud SQL proxy está corriendo");
      console.error("   - La base de datos está accesible");
      throw new Error("No se pudo conectar a la base de datos");
    }
    
    // Otro tipo de error
    console.error("Error verificando si las tablas existen:", errorMessage);
    return false;
  }
}

async function needsUserSeed() {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@trabajoya.dev" },
    });
    return !adminUser;
  } catch (error) {
    console.error("Error verificando usuario admin:", error);
    return false;
  }
}

async function needsCatalogSeed(catalogType) {
  try {
    const count = await prisma.catalog.count({
      where: { type: catalogType },
    });
    return count === 0;
  } catch (error) {
    console.error(`Error verificando catálogo ${catalogType}:`, error);
    return false;
  }
}

async function needsPlanSeed(planCode) {
  try {
    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
    });
    return !plan;
  } catch (error) {
    console.error(`Error verificando plan ${planCode}:`, error);
    return false;
  }
}

async function needsIapProductSeed() {
  try {
    const count = await prisma.iapProduct.count();
    return count === 0;
  } catch (error) {
    console.error("Error verificando productos IAP:", error);
    return false;
  }
}

async function checkWhatNeedsSeed() {
  const needsSeed = {
    user: false,
    catalogs: [],
    plans: [],
    iapProducts: false,
    needsAnySeed: false,
  };

  try {
    // Verificar usuario admin
    needsSeed.user = await needsUserSeed();
    if (needsSeed.user) {
      console.log("  ⚠️  Usuario admin no encontrado");
      needsSeed.needsAnySeed = true;
    } else {
      console.log("  ✅ Usuario admin existe");
    }

    // Verificar cada tipo de catálogo
    for (const catalogType of CATALOG_TYPES) {
      const needs = await needsCatalogSeed(catalogType);
      if (needs) {
        needsSeed.catalogs.push(catalogType);
        console.log(`  ⚠️  Catálogo ${catalogType} está vacío`);
        needsSeed.needsAnySeed = true;
      } else {
        console.log(`  ✅ Catálogo ${catalogType} tiene datos`);
      }
    }

    // Verificar cada plan
    for (const planCode of PLAN_CODES) {
      const needs = await needsPlanSeed(planCode);
      if (needs) {
        needsSeed.plans.push(planCode);
        console.log(`  ⚠️  Plan ${planCode} no existe`);
        needsSeed.needsAnySeed = true;
      } else {
        console.log(`  ✅ Plan ${planCode} existe`);
      }
    }

    // Verificar productos IAP
    needsSeed.iapProducts = await needsIapProductSeed();
    if (needsSeed.iapProducts) {
      console.log("  ⚠️  Productos IAP no encontrados");
      needsSeed.needsAnySeed = true;
    } else {
      console.log("  ✅ Productos IAP existen");
    }
  } catch (error) {
    console.error("Error verificando qué necesita seed:", error);
    // En caso de error, asumir que necesita seed para ser seguro
    needsSeed.needsAnySeed = true;
  }

  return needsSeed;
}

async function runSeed() {
  console.log("🌱 Ejecutando seed desde prisma/seed.ts...");

  // Ejecutar el seed TypeScript usando el script de npm
  const { execSync } = require("child_process");

  try {
    // En producción (Cloud Run), usar ts-node directamente ya que tenemos las dependencias
    // En desarrollo, usar el script de npm
    const isProduction = process.env.NODE_ENV === "production";
    
    if (isProduction) {
      // En producción, ejecutar directamente con ts-node
      execSync("npx ts-node --transpile-only prisma/seed.ts", {
        stdio: "inherit",
        env: process.env,
        cwd: process.cwd(),
      });
    } else {
      // En desarrollo, usar el script configurado en package.json
      execSync("npm run prisma:seed", {
        stdio: "inherit",
        env: process.env,
        cwd: process.cwd(),
      });
    }
    console.log("✅ Seed ejecutado exitosamente desde prisma/seed.ts");
  } catch (error) {
    console.error("❌ Error ejecutando seed:", error.message);
    throw error;
  }
}

async function main() {
  console.log("🔍 Verificando qué tablas necesitan seed...");

  try {
    // Primero verificar si las tablas existen y si podemos conectar
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      console.log(
        "⚠️  Las tablas no existen. El esquema debe aplicarse primero."
      );
      console.log("💡 Ejecuta las migraciones antes de correr el seed.");
      return;
    }

    // Verificar cada tabla individualmente
    const needsSeed = await checkWhatNeedsSeed();

    if (!needsSeed.needsAnySeed) {
      console.log("\n✅ Todas las tablas ya contienen los datos necesarios. Saltando seed.");
      return;
    }

    console.log("\n📊 Resumen de lo que necesita seed:");
    if (needsSeed.user) {
      console.log(`  - Usuario admin`);
    }
    if (needsSeed.catalogs.length > 0) {
      console.log(`  - Catálogos: ${needsSeed.catalogs.join(", ")}`);
    }
    if (needsSeed.plans.length > 0) {
      console.log(`  - Planes: ${needsSeed.plans.join(", ")}`);
    }
    if (needsSeed.iapProducts) {
      console.log(`  - Productos IAP`);
    }

    console.log("\n📦 Ejecutando seed...");
    await runSeed();
    console.log("✅ Seed ejecutado exitosamente.");
  } catch (error) {
    // Si es un error de conexión, lanzarlo para que se maneje arriba
    if (error.message && error.message.includes("No se pudo conectar")) {
      throw error;
    }
    // Otros errores se manejan normalmente
    throw error;
  }
}

main()
  .catch((error) => {
    const errorMessage = error.message || error.toString();
    
    // Si es un error de conexión, dar un mensaje más específico
    if (errorMessage.includes("No se pudo conectar")) {
      console.error("\n❌ No se pudo conectar a la base de datos.");
      console.error("💡 El seed se saltará. Verifica la configuración de Cloud SQL.");
      // No fallar el despliegue, pero registrar el problema claramente
    } else {
      console.error("❌ Error en seed-if-empty:", errorMessage);
    }
    
    // No fallar el despliegue por un error de seed
    // El seed puede ejecutarse manualmente después si es necesario
    process.exit(0);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      // Ignorar errores al desconectar si ya había un problema de conexión
    }
  });
