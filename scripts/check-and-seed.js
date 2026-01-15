const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkAndSeed() {
  try {
    console.log("🔍 Verificando si necesitamos seed...");

    // Verificá si ya hay datos (ajustá según tu modelo principal)
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      console.log("🌱 Base de datos vacía. Ejecutando seed...");

      // Acá va tu lógica de seed
      // Ejemplo:
      await prisma.user.create({
        data: {
          email: "admin@trabajo-ya.com",
          name: "Admin",
          password: "hashed_password", // Usar bcrypt en producción
          role: "ADMIN",
        },
      });

      // Más seeds si necesitás...

      console.log("✅ Seed completado exitosamente");
    } else {
      console.log("✓ La base de datos ya tiene datos. Saltando seed.");
    }
  } catch (error) {
    console.error("❌ Error en seed:", error);
    // No fallar el deploy por un error de seed
    console.log("⚠️  Continuando con el inicio...");
  } finally {
    await prisma.$disconnect();
  }
}

checkAndSeed();
