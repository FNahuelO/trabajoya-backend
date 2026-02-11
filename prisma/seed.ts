import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@trabajoya.dev" },
    update: {},
    create: {
      email: "admin@trabajoya.dev",
      passwordHash,
      userType: "EMPRESA",
      isVerified: true,
    },
  });

  /*  // Crear múltiples trabajos de prueba
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

  console.log(`✅ Seed completo: ${jobs.length} trabajos creados`); */

  // Crear catálogos
  const jobAreas = [
    {
      code: "COMERCIAL_VENTAS_NEGOCIOS",
      es: "Comercial, Ventas y Negocios",
      en: "Commercial, Sales & Business",
      pt: "Comercial, Vendas e Negócios",
    },
    {
      code: "ADMIN_CONTABILIDAD_FINANZAS",
      es: "Administración, Contabilidad y Finanzas",
      en: "Administration, Accounting & Finance",
      pt: "Administração, Contabilidade e Finanças",
    },
    {
      code: "PRODUCCION_MANUFACTURA",
      es: "Producción y Manufactura",
      en: "Production & Manufacturing",
      pt: "Produção e Manufatura",
    },
    {
      code: "OFICIOS_Y_OTROS",
      es: "Oficios y Otros",
      en: "Trades & Other",
      pt: "Ofícios e Outros",
    },
    {
      code: "ABASTECIMIENTO_LOGISTICA",
      es: "Abastecimiento y Logística",
      en: "Supply & Logistics",
      pt: "Suprimentos e Logística",
    },
    {
      code: "GASTRONOMIA_TURISMO",
      es: "Gastronomía y Turismo",
      en: "Gastronomy & Tourism",
      pt: "Gastronomia e Turismo",
    },
    {
      code: "TECNOLOGIA_SISTEMAS_TELECOM",
      es: "Tecnología, Sistemas y Telecomunicaciones",
      en: "Technology, Systems & Telecommunications",
      pt: "Tecnologia, Sistemas e Telecomunicações",
    },
    {
      code: "ATENCION_CLIENTE_CALLCENTER_TELEMARKETING",
      es: "Atención al Cliente, Call Center y Telemarketing",
      en: "Customer Service, Call Center & Telemarketing",
      pt: "Atendimento ao Cliente, Call Center e Telemarketing",
    },
    {
      code: "SALUD_MEDICINA_FARMACIA",
      es: "Salud, Medicina y Farmacia",
      en: "Health, Medicine & Pharmacy",
      pt: "Saúde, Medicina e Farmácia",
    },
    {
      code: "INGENIERIAS",
      es: "Ingenierías",
      en: "Engineering",
      pt: "Engenharias",
    },
    {
      code: "RRHH_CAPACITACION",
      es: "Recursos Humanos y Capacitación",
      en: "Human Resources & Training",
      pt: "Recursos Humanos e Capacitação",
    },
    {
      code: "MARKETING_PUBLICIDAD",
      es: "Marketing y Publicidad",
      en: "Marketing & Advertising",
      pt: "Marketing e Publicidade",
    },
    {
      code: "ING_CIVIL_CONSTRUCCION",
      es: "Ingeniería Civil y Construcción",
      en: "Civil Engineering & Construction",
      pt: "Engenharia Civil e Construção",
    },
    { code: "LEGALES", es: "Legales", en: "Legal", pt: "Jurídico" },
    {
      code: "SECRETARIAS_RECEPCION",
      es: "Secretarias y Recepción",
      en: "Secretarial & Reception",
      pt: "Secretaria e Recepção",
    },
    { code: "DISENO", es: "Diseño", en: "Design", pt: "Design" },
    {
      code: "ADUANA_COMERCIO_EXTERIOR",
      es: "Aduana y Comercio Exterior",
      en: "Customs & Foreign Trade",
      pt: "Aduana e Comércio Exterior",
    },
    { code: "SEGUROS", es: "Seguros", en: "Insurance", pt: "Seguros" },
    {
      code: "GERENCIA_DIRECCION_GENERAL",
      es: "Gerencia y Dirección General",
      en: "Management & General Direction",
      pt: "Gerência e Diretoria Geral",
    },
    {
      code: "MINERIA_PETROLEO_GAS",
      es: "Minería, Petróleo y Gas",
      en: "Mining, Oil & Gas",
      pt: "Mineração, Petróleo e Gás",
    },
    {
      code: "DEPARTAMENTO_TECNICO",
      es: "Departamento Tecnico",
      en: "Technical Department",
      pt: "Departamento Técnico",
    },
    {
      code: "EDUCACION_DOCENCIA_INVESTIGACION",
      es: "Educación, Docencia e Investigación",
      en: "Education, Teaching & Research",
      pt: "Educação, Docência e Pesquisa",
    },
    {
      code: "COMUNICACION_RELACIONES_PUBLICAS",
      es: "Comunicación, Relaciones Institucionales y Públicas",
      en: "Communication, Institutional & Public Relations",
      pt: "Comunicação, Relações Institucionais e Públicas",
    },
    { code: "ENFERMERIA", es: "Enfermería", en: "Nursing", pt: "Enfermagem" },
    {
      code: "NAVIERA_MARITIMA_PORTUARIA",
      es: "Naviero, Maritimo, Portuario",
      en: "Shipping, Maritime & Port",
      pt: "Naval, Marítimo e Portuário",
    },
  ];

  const jobTypes = [
    {
      code: "FULL_TIME",
      es: "Tiempo completo",
      en: "Full-time",
      pt: "Tempo integral",
    },
    {
      code: "PART_TIME",
      es: "Medio tiempo",
      en: "Part-time",
      pt: "Meio período",
    },
    { code: "POR_HORAS", es: "Por horas", en: "Hourly", pt: "Por hora" },
    { code: "TEMPORARIO", es: "Temporario", en: "Temporary", pt: "Temporário" },
    { code: "PASANTIA", es: "Pasantía", en: "Internship", pt: "Estágio" },
    {
      code: "POR_CONTRATO",
      es: "Por contrato",
      en: "Contract",
      pt: "Contrato",
    },
    { code: "NOCTURNO", es: "Nocturno", en: "Night shift", pt: "Noturno" },
  ];

  const jobLevels = [
    { code: "SEMI_SR", es: "Semi Sr", en: "Mid-level", pt: "Pleno" },
    { code: "JUNIOR", es: "Junior", en: "Junior", pt: "Júnior" },
    { code: "SENIOR", es: "Senior", en: "Senior", pt: "Sênior" },
    {
      code: "SENIOR_O_SEMI_SENIOR",
      es: "Senior / Semi-Senior",
      en: "Senior / Mid-level",
      pt: "Sênior / Pleno",
    },
    {
      code: "JEFE_SUPERVISOR_RESPONSABLE",
      es: "Jefe / Supervisor / Responsable",
      en: "Lead / Supervisor / Manager",
      pt: "Chefe / Supervisor / Responsável",
    },
    { code: "OTRO", es: "Otro", en: "Other", pt: "Outro" },
    {
      code: "GERENCIA_ALTA_GERENCIA_DIRECCION",
      es: "Gerencia / Alta Gerencia / Dirección",
      en: "Management / Senior Management / Director",
      pt: "Gerência / Alta Gerência / Diretoria",
    },
    {
      code: "SIN_EXPERIENCIA",
      es: "Sin Experiencia",
      en: "No experience",
      pt: "Sem experiência",
    },
    {
      code: "TRAINEE_PASANTE",
      es: "Trainee / Pasante",
      en: "Trainee / Intern",
      pt: "Trainee / Estagiário",
    },
  ];

  const modalities = [
    { code: "PRESENCIAL", es: "Presencial", en: "On-site", pt: "Presencial" },
    { code: "REMOTO", es: "Remoto", en: "Remote", pt: "Remoto" },
    { code: "HIBRIDO", es: "Híbrido", en: "Hybrid", pt: "Híbrido" },
  ];

  // Crear áreas de trabajo
  let order = 10;
  for (const area of jobAreas) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "JOB_AREA", code: area.code } },
      update: {},
      create: {
        type: "JOB_AREA",
        code: area.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: area.es },
            { lang: "EN", label: area.en },
            { lang: "PT", label: area.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear tipos de trabajo
  order = 10;
  for (const type of jobTypes) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "JOB_TYPE", code: type.code } },
      update: {},
      create: {
        type: "JOB_TYPE",
        code: type.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: type.es },
            { lang: "EN", label: type.en },
            { lang: "PT", label: type.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear niveles laborales
  order = 10;
  for (const level of jobLevels) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "JOB_LEVEL", code: level.code } },
      update: {},
      create: {
        type: "JOB_LEVEL",
        code: level.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: level.es },
            { lang: "EN", label: level.en },
            { lang: "PT", label: level.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear modalidades
  order = 10;
  for (const modality of modalities) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "MODALITIES", code: modality.code } },
      update: {},
      create: {
        type: "MODALITIES",
        code: modality.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: modality.es },
            { lang: "EN", label: modality.en },
            { lang: "PT", label: modality.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear JOB_TYPES (duplicado de JOB_TYPE para compatibilidad)
  order = 10;
  for (const type of jobTypes) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "JOB_TYPES", code: type.code } },
      update: {},
      create: {
        type: "JOB_TYPES",
        code: type.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: type.es },
            { lang: "EN", label: type.en },
            { lang: "PT", label: type.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear EXPERIENCE_LEVELS
  const experienceLevels = [
    { code: "JUNIOR", es: "Junior", en: "Junior", pt: "Júnior" },
    { code: "SEMISENIOR", es: "Semi Senior", en: "Mid-level", pt: "Pleno" },
    { code: "SENIOR", es: "Senior", en: "Senior", pt: "Sênior" },
    {
      code: "SIN_EXPERIENCIA",
      es: "Sin Experiencia",
      en: "No experience",
      pt: "Sem experiência",
    },
    { code: "TRAINEE", es: "Trainee", en: "Trainee", pt: "Trainee" },
  ];

  order = 10;
  for (const level of experienceLevels) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "EXPERIENCE_LEVELS", code: level.code } },
      update: {},
      create: {
        type: "EXPERIENCE_LEVELS",
        code: level.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: level.es },
            { lang: "EN", label: level.en },
            { lang: "PT", label: level.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear APPLICATION_STATUSES
  const applicationStatuses = [
    { code: "PENDING", es: "Pendiente", en: "Pending", pt: "Pendente" },
    { code: "REVIEWED", es: "Revisado", en: "Reviewed", pt: "Revisado" },
    { code: "ACCEPTED", es: "Aceptado", en: "Accepted", pt: "Aceito" },
    { code: "REJECTED", es: "Rechazado", en: "Rejected", pt: "Rejeitado" },
    { code: "INTERVIEW", es: "Entrevista", en: "Interview", pt: "Entrevista" },
  ];

  order = 10;
  for (const status of applicationStatuses) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "APPLICATION_STATUSES", code: status.code } },
      update: {},
      create: {
        type: "APPLICATION_STATUSES",
        code: status.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: status.es },
            { lang: "EN", label: status.en },
            { lang: "PT", label: status.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear LANGUAGE_LEVELS
  const languageLevels = [
    { code: "BASIC", es: "Básico", en: "Basic", pt: "Básico" },
    {
      code: "INTERMEDIATE",
      es: "Intermedio",
      en: "Intermediate",
      pt: "Intermediário",
    },
    { code: "ADVANCED", es: "Avanzado", en: "Advanced", pt: "Avançado" },
    { code: "NATIVE", es: "Nativo", en: "Native", pt: "Nativo" },
  ];

  order = 10;
  for (const level of languageLevels) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "LANGUAGE_LEVELS", code: level.code } },
      update: {},
      create: {
        type: "LANGUAGE_LEVELS",
        code: level.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: level.es },
            { lang: "EN", label: level.en },
            { lang: "PT", label: level.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear COMPANY_SIZES
  const companySizes = [
    {
      code: "MICRO",
      es: "Micro (1-5 empleados)",
      en: "Micro (1-5 employees)",
      pt: "Micro (1-5 funcionários)",
    },
    {
      code: "PEQUENA",
      es: "Pequeña (6-50 empleados)",
      en: "Small (6-50 employees)",
      pt: "Pequena (6-50 funcionários)",
    },
    {
      code: "MEDIANA",
      es: "Mediana (51-200 empleados)",
      en: "Medium (51-200 employees)",
      pt: "Média (51-200 funcionários)",
    },
    {
      code: "GRANDE",
      es: "Grande (201-1000 empleados)",
      en: "Large (201-1000 employees)",
      pt: "Grande (201-1000 funcionários)",
    },
    {
      code: "MULTINACIONAL",
      es: "Multinacional (+1000 empleados)",
      en: "Multinational (+1000 employees)",
      pt: "Multinacional (+1000 funcionários)",
    },
  ];

  order = 10;
  for (const size of companySizes) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "COMPANY_SIZES", code: size.code } },
      update: {},
      create: {
        type: "COMPANY_SIZES",
        code: size.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: size.es },
            { lang: "EN", label: size.en },
            { lang: "PT", label: size.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear SECTORS
  // Función para generar código normalizado desde el nombre
  const generateCode = (nombre: string): string => {
    return nombre
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remover acentos
      .replace(/[^A-Z0-9]/g, "_") // Reemplazar caracteres especiales con _
      .replace(/_+/g, "_") // Reemplazar múltiples _ con uno solo
      .replace(/^_|_$/g, ""); // Remover _ del inicio y final
  };

  const sectors = [
    {
      code: generateCode("Administración"),
      es: "Administración",
      en: "Administration",
      pt: "Administração",
    },
    {
      code: generateCode("Aérea"),
      es: "Aérea",
      en: "Aviation",
      pt: "Aérea",
    },
    {
      code: generateCode("AFJP"),
      es: "AFJP",
      en: "AFJP",
      pt: "AFJP",
    },
    {
      code: generateCode("Agro-Industrial"),
      es: "Agro-Industrial",
      en: "Agro-Industrial",
      pt: "Agro-Industrial",
    },
    {
      code: generateCode("Agropecuaria"),
      es: "Agropecuaria",
      en: "Agriculture & Livestock",
      pt: "Agropecuária",
    },
    {
      code: generateCode("Alimenticia"),
      es: "Alimenticia",
      en: "Food Industry",
      pt: "Alimentícia",
    },
    {
      code: generateCode("Arquitectura"),
      es: "Arquitectura",
      en: "Architecture",
      pt: "Arquitetura",
    },
    {
      code: generateCode("Artesanal"),
      es: "Artesanal",
      en: "Handicrafts",
      pt: "Artesanal",
    },
    {
      code: generateCode("Automotriz"),
      es: "Automotriz",
      en: "Automotive",
      pt: "Automotiva",
    },
    {
      code: generateCode("Banca / Financiera"),
      es: "Banca / Financiera",
      en: "Banking / Financial",
      pt: "Banca / Financeira",
    },
    {
      code: generateCode("Biotecnología"),
      es: "Biotecnología",
      en: "Biotechnology",
      pt: "Biotecnologia",
    },
    {
      code: generateCode("Call Center"),
      es: "Call Center",
      en: "Call Center",
      pt: "Call Center",
    },
    {
      code: generateCode("Comercio"),
      es: "Comercio",
      en: "Commerce",
      pt: "Comércio",
    },
    {
      code: generateCode("Comercio Exterior"),
      es: "Comercio Exterior",
      en: "Foreign Trade",
      pt: "Comércio Exterior",
    },
    {
      code: generateCode("Comunicaciones"),
      es: "Comunicaciones",
      en: "Communications",
      pt: "Comunicações",
    },
    {
      code: generateCode("Construcción"),
      es: "Construcción",
      en: "Construction",
      pt: "Construção",
    },
    {
      code: generateCode("Consultora de Recursos Humanos"),
      es: "Consultora de Recursos Humanos",
      en: "Human Resources Consulting",
      pt: "Consultoria de Recursos Humanos",
    },
    {
      code: generateCode("Consultoría"),
      es: "Consultoría",
      en: "Consulting",
      pt: "Consultoria",
    },
    {
      code: generateCode("Consumo masivo"),
      es: "Consumo masivo",
      en: "Mass Consumption",
      pt: "Consumo massivo",
    },
    {
      code: generateCode("Correo"),
      es: "Correo",
      en: "Postal",
      pt: "Correios",
    },
    {
      code: generateCode("Defensa"),
      es: "Defensa",
      en: "Defense",
      pt: "Defesa",
    },
    {
      code: generateCode("Diseño"),
      es: "Diseño",
      en: "Design",
      pt: "Design",
    },
    {
      code: generateCode("Editorial"),
      es: "Editorial",
      en: "Publishing",
      pt: "Editorial",
    },
    {
      code: generateCode("Educación"),
      es: "Educación",
      en: "Education",
      pt: "Educação",
    },
    {
      code: generateCode("Energía"),
      es: "Energía",
      en: "Energy",
      pt: "Energia",
    },
    {
      code: generateCode("Entretenimiento"),
      es: "Entretenimiento",
      en: "Entertainment",
      pt: "Entretenimento",
    },
    {
      code: generateCode("Farmacéutica"),
      es: "Farmacéutica",
      en: "Pharmaceutical",
      pt: "Farmacêutica",
    },
    {
      code: generateCode("Ferroviaria"),
      es: "Ferroviaria",
      en: "Railway",
      pt: "Ferroviária",
    },
    {
      code: generateCode("Financiera"),
      es: "Financiera",
      en: "Financial",
      pt: "Financeira",
    },
    {
      code: generateCode("Forestal"),
      es: "Forestal",
      en: "Forestry",
      pt: "Florestal",
    },
    {
      code: generateCode("Ganadería"),
      es: "Ganadería",
      en: "Livestock",
      pt: "Pecuária",
    },
    {
      code: generateCode("Gastronomía"),
      es: "Gastronomía",
      en: "Gastronomy",
      pt: "Gastronomia",
    },
    {
      code: generateCode("Gobierno"),
      es: "Gobierno",
      en: "Government",
      pt: "Governo",
    },
    {
      code: generateCode("Higiene y Perfumería"),
      es: "Higiene y Perfumería",
      en: "Hygiene & Perfumery",
      pt: "Higiene e Perfumaria",
    },
    {
      code: generateCode("Holding"),
      es: "Holding",
      en: "Holding",
      pt: "Holding",
    },
    {
      code: generateCode("Hotelería"),
      es: "Hotelería",
      en: "Hospitality",
      pt: "Hotelaria",
    },
    {
      code: generateCode("Imprenta"),
      es: "Imprenta",
      en: "Printing",
      pt: "Impressão",
    },
    {
      code: generateCode("Industrial"),
      es: "Industrial",
      en: "Industrial",
      pt: "Industrial",
    },
    {
      code: generateCode("Información e Investigación"),
      es: "Información e Investigación",
      en: "Information & Research",
      pt: "Informação e Pesquisa",
    },
    {
      code: generateCode("Informática / Tecnología"),
      es: "Informática / Tecnología",
      en: "IT / Technology",
      pt: "Informática / Tecnologia",
    },
    {
      code: generateCode("Inmobiliaria"),
      es: "Inmobiliaria",
      en: "Real Estate",
      pt: "Imobiliária",
    },
    {
      code: generateCode("Internet"),
      es: "Internet",
      en: "Internet",
      pt: "Internet",
    },
    {
      code: generateCode("Jurídica"),
      es: "Jurídica",
      en: "Legal",
      pt: "Jurídica",
    },
    {
      code: generateCode("Laboratorio"),
      es: "Laboratorio",
      en: "Laboratory",
      pt: "Laboratório",
    },
    {
      code: generateCode("Manufactura"),
      es: "Manufactura",
      en: "Manufacturing",
      pt: "Manufatura",
    },
    {
      code: generateCode("Medio Ambiente"),
      es: "Medio Ambiente",
      en: "Environment",
      pt: "Meio Ambiente",
    },
    {
      code: generateCode("Medios"),
      es: "Medios",
      en: "Media",
      pt: "Mídia",
    },
    {
      code: generateCode("Metalmecánica"),
      es: "Metalmecánica",
      en: "Metalworking",
      pt: "Metalomecânica",
    },
    {
      code: generateCode("Minería / Petróleo / Gas"),
      es: "Minería / Petróleo / Gas",
      en: "Mining / Oil / Gas",
      pt: "Mineração / Petróleo / Gás",
    },
    {
      code: generateCode("ONGs"),
      es: "ONGs",
      en: "NGOs",
      pt: "ONGs",
    },
    {
      code: generateCode("Optica"),
      es: "Optica",
      en: "Optics",
      pt: "Óptica",
    },
    {
      code: generateCode("Otra"),
      es: "Otra",
      en: "Other",
      pt: "Outra",
    },
    {
      code: generateCode("Papelera"),
      es: "Papelera",
      en: "Paper Industry",
      pt: "Papelaria",
    },
    {
      code: generateCode("Pesca"),
      es: "Pesca",
      en: "Fishing",
      pt: "Pesca",
    },
    {
      code: generateCode("Petroquímica"),
      es: "Petroquímica",
      en: "Petrochemical",
      pt: "Petroquímica",
    },
    {
      code: generateCode("Plásticos"),
      es: "Plásticos",
      en: "Plastics",
      pt: "Plásticos",
    },
    {
      code: generateCode("Publicidad / Marketing / RRPP"),
      es: "Publicidad / Marketing / RRPP",
      en: "Advertising / Marketing / PR",
      pt: "Publicidade / Marketing / RP",
    },
    {
      code: generateCode("Química"),
      es: "Química",
      en: "Chemical",
      pt: "Química",
    },
    {
      code: generateCode("Retail"),
      es: "Retail",
      en: "Retail",
      pt: "Varejo",
    },
    {
      code: generateCode("Salud"),
      es: "Salud",
      en: "Health",
      pt: "Saúde",
    },
    {
      code: generateCode("Sector público"),
      es: "Sector público",
      en: "Public Sector",
      pt: "Setor público",
    },
    {
      code: generateCode("Seguridad"),
      es: "Seguridad",
      en: "Security",
      pt: "Segurança",
    },
    {
      code: generateCode("Seguros"),
      es: "Seguros",
      en: "Insurance",
      pt: "Seguros",
    },
    {
      code: generateCode("Servicios"),
      es: "Servicios",
      en: "Services",
      pt: "Serviços",
    },
    {
      code: generateCode("Siderurgia"),
      es: "Siderurgia",
      en: "Steel Industry",
      pt: "Siderurgia",
    },
    {
      code: generateCode("Supermercado / Hipermercado"),
      es: "Supermercado / Hipermercado",
      en: "Supermarket / Hypermarket",
      pt: "Supermercado / Hipermercado",
    },
    {
      code: generateCode("Tabacalera"),
      es: "Tabacalera",
      en: "Tobacco",
      pt: "Tabacaria",
    },
    {
      code: generateCode("Telecomunicaciones"),
      es: "Telecomunicaciones",
      en: "Telecommunications",
      pt: "Telecomunicações",
    },
    {
      code: generateCode("Textil"),
      es: "Textil",
      en: "Textile",
      pt: "Têxtil",
    },
    {
      code: generateCode("Transportadora"),
      es: "Transportadora",
      en: "Transportation Company",
      pt: "Transportadora",
    },
    {
      code: generateCode("Transporte"),
      es: "Transporte",
      en: "Transportation",
      pt: "Transporte",
    },
    {
      code: generateCode("Turismo"),
      es: "Turismo",
      en: "Tourism",
      pt: "Turismo",
    },
  ];

  order = 10;
  for (const sector of sectors) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "SECTORS", code: sector.code } },
      update: {},
      create: {
        type: "SECTORS",
        code: sector.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: sector.es },
            { lang: "EN", label: sector.en },
            { lang: "PT", label: sector.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear STUDY_TYPES
  const studyTypes = [
    { code: "PRIMARIO", es: "Primario", en: "Primary", pt: "Primário" },
    { code: "SECUNDARIO", es: "Secundario", en: "Secondary", pt: "Secundário" },
    { code: "TERCIARIO", es: "Terciario", en: "Tertiary", pt: "Terciário" },
    {
      code: "UNIVERSITARIO",
      es: "Universitario",
      en: "University",
      pt: "Universitário",
    },
    { code: "POSGRADO", es: "Posgrado", en: "Graduate", pt: "Pós-graduação" },
    { code: "MAESTRIA", es: "Maestría", en: "Master's", pt: "Mestrado" },
    { code: "DOCTORADO", es: "Doctorado", en: "Doctorate", pt: "Doutorado" },
    { code: "TECNICO", es: "Técnico", en: "Technical", pt: "Técnico" },
    { code: "CURSO", es: "Curso", en: "Course", pt: "Curso" },
    {
      code: "CERTIFICACION",
      es: "Certificación",
      en: "Certification",
      pt: "Certificação",
    },
  ];

  order = 10;
  for (const studyType of studyTypes) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "STUDY_TYPES", code: studyType.code } },
      update: {},
      create: {
        type: "STUDY_TYPES",
        code: studyType.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: studyType.es },
            { lang: "EN", label: studyType.en },
            { lang: "PT", label: studyType.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear STUDY_STATUSES
  const studyStatuses = [
    { code: "EN_CURSO", es: "En curso", en: "In progress", pt: "Em andamento" },
    { code: "COMPLETADO", es: "Completado", en: "Completed", pt: "Completo" },
    { code: "ABANDONADO", es: "Abandonado", en: "Abandoned", pt: "Abandonado" },
    { code: "SUSPENDIDO", es: "Suspendido", en: "Suspended", pt: "Suspenso" },
  ];

  order = 10;
  for (const status of studyStatuses) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "STUDY_STATUSES", code: status.code } },
      update: {},
      create: {
        type: "STUDY_STATUSES",
        code: status.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: status.es },
            { lang: "EN", label: status.en },
            { lang: "PT", label: status.pt },
          ],
        },
      },
    });
    order += 10;
  }

  // Crear MARITAL_STATUSES
  const maritalStatuses = [
    { code: "SOLTERO", es: "Soltero/a", en: "Single", pt: "Solteiro/a" },
    { code: "CASADO", es: "Casado/a", en: "Married", pt: "Casado/a" },
    {
      code: "DIVORCIADO",
      es: "Divorciado/a",
      en: "Divorced",
      pt: "Divorciado/a",
    },
    { code: "VIUDO", es: "Viudo/a", en: "Widowed", pt: "Viúvo/a" },
    {
      code: "UNION_LIBRE",
      es: "Unión libre",
      en: "Common-law",
      pt: "União estável",
    },
    { code: "SEPARADO", es: "Separado/a", en: "Separated", pt: "Separado/a" },
  ];

  order = 10;
  for (const status of maritalStatuses) {
    const catalog = await prisma.catalog.upsert({
      where: { type_code: { type: "MARITAL_STATUSES", code: status.code } },
      update: {},
      create: {
        type: "MARITAL_STATUSES",
        code: status.code,
        isActive: true,
        order,
        translations: {
          create: [
            { lang: "ES", label: status.es },
            { lang: "EN", label: status.en },
            { lang: "PT", label: status.pt },
          ],
        },
      },
    });
    order += 10;
  }

  console.log(
    `✅ Catálogos creados: ${jobAreas.length} áreas, ${jobTypes.length} tipos, ${jobLevels.length} niveles, ${modalities.length} modalidades, ${experienceLevels.length} niveles de experiencia, ${applicationStatuses.length} estados de aplicación, ${languageLevels.length} niveles de idioma, ${companySizes.length} tamaños de empresa, ${sectors.length} sectores, ${studyTypes.length} tipos de estudio, ${studyStatuses.length} estados de estudio, ${maritalStatuses.length} estados civiles`
  );


  // Crear promoción demo para empresa de prueba (si existe)
  const empresaTest = await prisma.user.findUnique({
    where: { email: "empresa.test@trabajoya.com" },
    include: { empresa: true },
  });

  if (empresaTest && empresaTest.empresa) {
    // Verificar si la ventana de promoción está abierta
    const startAt = process.env.LAUNCH_TRIAL_START_AT;
    const endAt = process.env.LAUNCH_TRIAL_END_AT;
    const now = new Date();
    let windowOpen = false;

    if (startAt && endAt) {
      try {
        const start = new Date(startAt);
        const end = new Date(endAt);
        windowOpen = now >= start && now <= end;
      } catch (error) {
        console.warn("Error parsing LAUNCH_TRIAL dates:", error);
      }
    }

    if (windowOpen) {
      const promotion = await prisma.userPromotion.upsert({
        where: {
          userId_promoKey: {
            userId: empresaTest.id,
            promoKey: "LAUNCH_TRIAL_4D",
          },
        },
        update: {},
        create: {
          userId: empresaTest.id,
          promoKey: "LAUNCH_TRIAL_4D",
          status: "AVAILABLE",
          metadata: {
            companyId: empresaTest.empresa.id,
            cuit: empresaTest.empresa.cuit,
            demo: true,
          },
        },
      });

      console.log(
        `✅ Promoción demo creada para empresa.test@trabajoya.com: ${promotion.id}`
      );
    }
  }

  // Crear productos IAP
  // IMPORTANTE: Estos Product IDs deben coincidir EXACTAMENTE con los de App Store Connect
  const iapProducts = [
    {
      productId: "job_urgent",
      platform: "IOS",
      planKey: "URGENT",
    },
    {
      productId: "job_urgent",
      platform: "ANDROID",
      planKey: "URGENT",
    },
    {
      productId: "job_standard",
      platform: "IOS",
      planKey: "STANDARD",
    },
    {
      productId: "job_standard",
      platform: "ANDROID",
      planKey: "STANDARD",
    },
    {
      productId: "job_premium",
      platform: "IOS",
      planKey: "PREMIUM",
    },
    {
      productId: "job_premium",
      platform: "ANDROID",
      planKey: "PREMIUM",
    },
    {
      productId: "job_crystal",
      platform: "IOS",
      planKey: "CRYSTAL",
    },
    {
      productId: "job_crystal",
      platform: "ANDROID",
      planKey: "CRYSTAL",
    },
  ];

  // Crear planes URGENT, STANDARD, CRYSTAL si no existen
  const plans = [
    {
      name: "URGENT",
      code: "URGENT",
      subscriptionPlan: "URGENT" as const,
      price: 19.99,
      currency: "USD",
      durationDays: 7,
      allowedModifications: 0,
      canModifyCategory: false,
      categoryModifications: 0,
      order: 10,
      description: "Plan Urgente: 7 días, 0 ediciones, sin cambio de rubro",
    },
    {
      name: "STANDARD",
      code: "STANDARD",
      subscriptionPlan: "STANDARD" as const,
      price: 29.99,
      currency: "USD",
      durationDays: 30,
      allowedModifications: 2,
      canModifyCategory: false,
      categoryModifications: 0,
      order: 20,
      description: "Plan Estándar: 30 días, 2 ediciones, sin cambio de rubro",
    },
    {
      name: "PREMIUM",
      code: "PREMIUM",
      subscriptionPlan: "PREMIUM" as const,
      price: 59.99,
      currency: "USD",
      durationDays: 45,
      allowedModifications: 3,
      canModifyCategory: true,
      categoryModifications: 1,
      order: 25,
      description: "Plan Premium: 45 días, 3 ediciones, 1 cambio de rubro",
    },
    {
      name: "CRYSTAL",
      code: "CRYSTAL",
      subscriptionPlan: "CRYSTAL" as const,
      price: 99.99,
      currency: "USD",
      durationDays: 60,
      allowedModifications: 4,
      canModifyCategory: true,
      categoryModifications: 1,
      order: 30,
      description: "Plan Crystal: 60 días, 4 ediciones, 1 cambio de rubro",
    },
  ];

  for (const planData of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: planData.code },
      update: {
        // Actualizar todos los campos del plan, especialmente subscriptionPlan
        subscriptionPlan: planData.subscriptionPlan,
        name: planData.name,
        price: planData.price,
        currency: planData.currency,
        durationDays: planData.durationDays,
        allowedModifications: planData.allowedModifications,
        canModifyCategory: planData.canModifyCategory,
        categoryModifications: planData.categoryModifications,
        order: planData.order,
        description: planData.description,
      },
      create: planData,
    });

    // Crear productos IAP para este plan
    for (const product of iapProducts.filter(
      (p) => p.planKey === planData.code
    )) {
      await prisma.iapProduct.upsert({
        where: {
          productId_platform: {
            productId: product.productId,
            platform: product.platform as any,
          },
        },
        update: {},
        create: {
          productId: product.productId,
          platform: product.platform as any,
          planKey: product.planKey,
          active: true,
        },
      });
    }
  }

  console.log(`✅ Planes IAP creados: ${plans.length}`);
  console.log(`✅ Productos IAP creados: ${iapProducts.length}`);
}
main().finally(() => prisma.$disconnect());
