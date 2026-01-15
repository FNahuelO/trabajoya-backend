/**
 * Script para ejecutar seed si la base de datos está vacía
 * Versión JavaScript para producción (no requiere ts-node)
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function isDatabaseEmpty() {
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
  console.log("🌱 Ejecutando seed...");
  
  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@trabajoya.dev" },
    update: {},
    create: {
      email: "admin@trabajoya.dev",
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

  // Crear múltiples trabajos de prueba
  const jobs = [
    {
      title: "Desarrollador Frontend React Native",
      description:
        "Buscamos desarrollador móvil con experiencia en React Native para proyecto innovador. Trabajo en equipo dinámico con tecnologías de vanguardia.",
      requirements:
        "React Native, TypeScript, JavaScript, Git, Redux, REST APIs",
      location: "Buenos Aires, Argentina",
      city: "Buenos Aires",
      state: "Buenos Aires",
      jobType: "REMOTO",
      workMode: "remoto",
      category: "Tecnología",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
    {
      title: "Backend Developer Node.js",
      description:
        "Desarrollador backend con sólidos conocimientos en Node.js y bases de datos. Participarás en el diseño e implementación de APIs robustas.",
      requirements:
        "Node.js, Express, PostgreSQL, MongoDB, Docker, Microservicios",
      location: "Rosario, Santa Fe",
      city: "Rosario",
      state: "Santa Fe",
      jobType: "HIBRIDO",
      workMode: "hibrido",
      category: "Tecnología",
      experienceLevel: "SENIOR",
      status: "active",
    },
    {
      title: "Full Stack Developer",
      description:
        "Desarrollador full stack para trabajar en proyectos web modernos. Stack MERN completo y metodologías ágiles.",
      requirements: "React, Node.js, MongoDB, Express, HTML, CSS, JavaScript",
      location: "Córdoba, Córdoba",
      city: "Córdoba",
      state: "Córdoba",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Tecnología",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
    {
      title: "Diseñador UX/UI",
      description:
        "Diseñador creativo para crear experiencias de usuario excepcionales. Trabajo colaborativo con equipos de desarrollo.",
      requirements: "Figma, Adobe XD, Sketch, Prototipado, User Research",
      location: "Mendoza, Mendoza",
      city: "Mendoza",
      state: "Mendoza",
      jobType: "REMOTO",
      workMode: "remoto",
      category: "Diseño",
      experienceLevel: "JUNIOR",
      status: "active",
    },
    {
      title: "Data Analyst",
      description:
        "Analista de datos para extraer insights valiosos. Trabajo con grandes volúmenes de información y herramientas de BI.",
      requirements: "Python, SQL, Power BI, Excel, Tableau, Estadística",
      location: "Buenos Aires, Argentina",
      city: "Buenos Aires",
      state: "Buenos Aires",
      jobType: "TIEMPO_COMPLETO",
      workMode: "hibrido",
      category: "Datos",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
  ];

  for (const job of jobs) {
    await prisma.job.create({
      data: {
        empresaId: empresa.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        city: job.city,
        state: job.state,
        jobType: job.jobType,
        workMode: job.workMode,
        category: job.category,
        experienceLevel: job.experienceLevel,
        status: job.status,
      },
    });
  }

  console.log(`✅ Seed completo: ${jobs.length} trabajos creados`);
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

