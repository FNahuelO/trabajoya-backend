import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function isDatabaseEmpty(): Promise<boolean> {
  try {
    // Verificar si hay usuarios en la base de datos
    const userCount = await prisma.user.count();
    return userCount === 0;
  } catch (error) {
    console.error("Error verificando si la base de datos está vacía:", error);
    // Si hay un error, asumimos que está vacía para intentar el seed
    return true;
  }
}

async function runSeed() {
  const passwordHash = await bcrypt.hash("AdminTrabajoya2026", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@trabajoya.com" },
    update: {},
    create: {
      email: "admin@trabajoya.com",
      passwordHash,
      userType: "ADMIN",
      isVerified: true,
    },
  });
  const empresa = await prisma.empresaProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      companyName: "TrabajoYa SA",
      cuit: "30700000001",
      email: "contacto@trabajoya.dev",
      ciudad: "Buenos Aires",
      provincia: "Buenos Aires",
      pais: "Argentina",
    },
  });

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
    // Evita usar process.exit(1) para compatibilidad en entornos donde 'process' no está definido.
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
