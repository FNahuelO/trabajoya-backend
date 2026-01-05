import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Creando términos y condiciones de ejemplo...");

  const uploadsDir = path.join(process.cwd(), "uploads");
  const termsDir = path.join(uploadsDir, "terms");

  // Crear directorios si no existen
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(termsDir)) {
    fs.mkdirSync(termsDir, { recursive: true });
  }

  // Verificar si ya existen términos activos
  const existingPostulante = await prisma.termsAndConditions.findFirst({
    where: {
      type: "POSTULANTE",
      isActive: true,
    },
  });

  const existingEmpresa = await prisma.termsAndConditions.findFirst({
    where: {
      type: "EMPRESA",
      isActive: true,
    },
  });

  const existingPrivacy = await prisma.termsAndConditions.findFirst({
    where: {
      type: "PRIVACY",
      isActive: true,
    },
  });

  // Crear términos para POSTULANTE si no existen
  if (!existingPostulante) {
    const fileUrl = "/uploads/terms/placeholder-postulante.pdf";
    const terms = await prisma.termsAndConditions.create({
      data: {
        type: "POSTULANTE",
        version: "1.0.0",
        fileUrl,
        isActive: true,
        description: "Términos y Condiciones para Postulantes - Versión 1.0.0",
      },
    });
    console.log("✅ Términos para POSTULANTE creados:", terms.id);
  } else {
    console.log("⚠️  Ya existen términos activos para POSTULANTE");
  }

  // Crear términos para EMPRESA si no existen
  if (!existingEmpresa) {
    const fileUrl = "/uploads/terms/placeholder-empresa.pdf";
    const terms = await prisma.termsAndConditions.create({
      data: {
        type: "EMPRESA",
        version: "1.0.0",
        fileUrl,
        isActive: true,
        description: "Términos y Condiciones para Empresas - Versión 1.0.0",
      },
    });
    console.log("✅ Términos para EMPRESA creados:", terms.id);
  } else {
    console.log("⚠️  Ya existen términos activos para EMPRESA");
  }

  // Crear términos para PRIVACY si no existen
  if (!existingPrivacy) {
    const fileUrl = "/uploads/terms/placeholder-privacy.pdf";
    const terms = await prisma.termsAndConditions.create({
      data: {
        type: "PRIVACY",
        version: "1.0.0",
        fileUrl,
        isActive: true,
        description: "Política de Privacidad - Versión 1.0.0",
      },
    });
    console.log("✅ Términos para PRIVACY creados:", terms.id);
  } else {
    console.log("⚠️  Ya existen términos activos para PRIVACY");
  }

  console.log("\n✨ Proceso completado!");
  console.log("\n📝 Nota: Los archivos PDF son placeholders.");
  console.log(
    "   Puedes subir PDFs reales usando el endpoint /api/terms/upload (requiere ser admin)"
  );
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
