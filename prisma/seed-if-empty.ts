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
    {
      title: "DevOps Engineer",
      description:
        "Ingeniero DevOps para automatización de infraestructura. Experiencia en cloud y CI/CD pipelines.",
      requirements: "AWS, Docker, Kubernetes, Jenkins, GitLab CI, Terraform",
      location: "Remoto",
      city: "Remoto",
      state: "Remoto",
      jobType: "REMOTO",
      workMode: "remoto",
      category: "Tecnología",
      experienceLevel: "SENIOR",
      status: "active",
    },
    {
      title: "Marketing Digital Specialist",
      description:
        "Especialista en marketing digital para gestionar campañas online. SEO, SEM y redes sociales.",
      requirements:
        "Google Ads, Facebook Ads, SEO, Analytics, Content Marketing",
      location: "Buenos Aires, Argentina",
      city: "Buenos Aires",
      state: "Buenos Aires",
      jobType: "MEDIO_TIEMPO",
      workMode: "remoto",
      category: "Marketing",
      experienceLevel: "JUNIOR",
      status: "active",
    },
    {
      title: "QA Tester Automation",
      description:
        "Tester de automatización para asegurar calidad del software. Desarrollo de tests automatizados.",
      requirements: "Selenium, Cypress, Jest, Testing, Automation",
      location: "Rosario, Santa Fe",
      city: "Rosario",
      state: "Santa Fe",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Tecnología",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
    {
      title: "Project Manager IT",
      description:
        "Líder de proyectos tecnológicos con metodologías ágiles. Gestión de equipos y coordinación de entregables.",
      requirements: "Scrum, Agile, Jira, Project Management, Liderazgo",
      location: "Córdoba, Córdoba",
      city: "Córdoba",
      state: "Córdoba",
      jobType: "TIEMPO_COMPLETO",
      workMode: "hibrido",
      category: "Gestión",
      experienceLevel: "SENIOR",
      status: "active",
    },
    {
      title: "Mobile Developer iOS",
      description:
        "Desarrollador iOS nativo para aplicaciones enterprise. Swift y SwiftUI.",
      requirements: "Swift, SwiftUI, Xcode, iOS SDK, Core Data",
      location: "Buenos Aires, Argentina",
      city: "Buenos Aires",
      state: "Buenos Aires",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Tecnología",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
    {
      title: "Contador Público",
      description:
        "Contador para gestión contable y fiscal de empresa en crecimiento. Liquidación de impuestos y balances.",
      requirements: "Contabilidad, Impuestos, Excel, Tango, Sistemas",
      location: "Mendoza, Mendoza",
      city: "Mendoza",
      state: "Mendoza",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Finanzas",
      experienceLevel: "SENIOR",
      status: "active",
    },
    {
      title: "Recepcionista Hotelero",
      description:
        "Recepcionista para hotel 4 estrellas. Atención al cliente y gestión de reservas.",
      requirements:
        "Atención al cliente, Inglés, Sistemas de reservas, Hotelería",
      location: "Bariloche, Río Negro",
      city: "Bariloche",
      state: "Río Negro",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Turismo",
      experienceLevel: "JUNIOR",
      status: "active",
    },
    {
      title: "Vendedor B2B",
      description:
        "Ejecutivo de ventas para clientes corporativos. Experiencia en ventas consultivas.",
      requirements: "Ventas, Negociación, CRM, Comunicación, Proactividad",
      location: "Buenos Aires, Argentina",
      city: "Buenos Aires",
      state: "Buenos Aires",
      jobType: "TIEMPO_COMPLETO",
      workMode: "hibrido",
      category: "Ventas",
      experienceLevel: "SEMISENIOR",
      status: "active",
    },
    {
      title: "Chef de Cocina",
      description:
        "Chef experimentado para restaurante gourmet. Creatividad y pasión por la gastronomía.",
      requirements:
        "Cocina profesional, Creatividad, Liderazgo, Higiene alimentaria",
      location: "Rosario, Santa Fe",
      city: "Rosario",
      state: "Santa Fe",
      jobType: "TIEMPO_COMPLETO",
      workMode: "presencial",
      category: "Gastronomía",
      experienceLevel: "SENIOR",
      status: "active",
    },
    {
      title: "Community Manager",
      description:
        "Community manager para gestión de redes sociales de marca reconocida. Creatividad y engagement.",
      requirements:
        "Redes sociales, Copywriting, Diseño gráfico básico, Análisis de métricas",
      location: "Remoto",
      city: "Remoto",
      state: "Remoto",
      jobType: "FREELANCE",
      workMode: "remoto",
      category: "Marketing",
      experienceLevel: "JUNIOR",
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
        jobType: job.jobType as any,
        workMode: job.workMode,
        category: job.category,
        experienceLevel: job.experienceLevel as any,
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
    // Evita usar process.exit(1) para compatibilidad en entornos donde 'process' no está definido.
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
