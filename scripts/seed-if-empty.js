/**
 * Script para ejecutar seed si la base de datos está vacía
 * Ejecuta el seed TypeScript completo (prisma/seed.ts) que incluye todos los catálogos
 */

const { PrismaClient } = require("@prisma/client");

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

async function isDatabaseEmpty() {
  try {
    // Primero verificar si las tablas existen
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      console.log(
        "⚠️  Las tablas no existen. El esquema debe aplicarse primero."
      );
      return false; // No ejecutar seed si no hay tablas
    }

    // Verificar si hay usuarios en la base de datos
    const userCount = await prisma.user.count();
    return userCount === 0;
  } catch (error) {
    console.error("Error verificando si la base de datos está vacía:", error);
    // Si hay un error (como tabla no existe), no ejecutar seed
    return false;
  }
}

async function runSeed() {
  console.log("🌱 Ejecutando seed desde prisma/seed.ts...");

  // Ejecutar el seed TypeScript usando el script de npm
  const { execSync } = require("child_process");

  try {
    // Usar el script configurado en package.json
    execSync("npm run prisma:seed", {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    });
    console.log("✅ Seed ejecutado exitosamente desde prisma/seed.ts");
  } catch (error) {
    console.error("❌ Error ejecutando seed:", error.message);
    throw error;
  }
}

async function main() {
  console.log("🔍 Verificando si la base de datos está vacía...");

  const isEmpty = await isDatabaseEmpty();

  if (!isEmpty) {
    console.log("✅ La base de datos ya contiene datos. Saltando seed.");
    return;
  }

  console.log("📦 La base de datos está vacía. Ejecutando seed...");
  await runSeed();
  console.log("✅ Seed ejecutado exitosamente.");
}

main()
  .catch((error) => {
    console.error("❌ Error en seed-if-empty:", error);
    // No fallar el despliegue por un error de seed
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
