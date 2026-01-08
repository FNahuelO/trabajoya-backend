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

  // Crear catálogos
  const jobAreas = [
    { code: "COMERCIAL_VENTAS_NEGOCIOS", es: "Comercial, Ventas y Negocios", en: "Commercial, Sales & Business", pt: "Comercial, Vendas e Negócios" },
    { code: "ADMIN_CONTABILIDAD_FINANZAS", es: "Administración, Contabilidad y Finanzas", en: "Administration, Accounting & Finance", pt: "Administração, Contabilidade e Finanças" },
    { code: "PRODUCCION_MANUFACTURA", es: "Producción y Manufactura", en: "Production & Manufacturing", pt: "Produção e Manufatura" },
    { code: "OFICIOS_Y_OTROS", es: "Oficios y Otros", en: "Trades & Other", pt: "Ofícios e Outros" },
    { code: "ABASTECIMIENTO_LOGISTICA", es: "Abastecimiento y Logística", en: "Supply & Logistics", pt: "Suprimentos e Logística" },
    { code: "GASTRONOMIA_TURISMO", es: "Gastronomía y Turismo", en: "Gastronomy & Tourism", pt: "Gastronomia e Turismo" },
    { code: "TECNOLOGIA_SISTEMAS_TELECOM", es: "Tecnología, Sistemas y Telecomunicaciones", en: "Technology, Systems & Telecommunications", pt: "Tecnologia, Sistemas e Telecomunicações" },
    { code: "ATENCION_CLIENTE_CALLCENTER_TELEMARKETING", es: "Atención al Cliente, Call Center y Telemarketing", en: "Customer Service, Call Center & Telemarketing", pt: "Atendimento ao Cliente, Call Center e Telemarketing" },
    { code: "SALUD_MEDICINA_FARMACIA", es: "Salud, Medicina y Farmacia", en: "Health, Medicine & Pharmacy", pt: "Saúde, Medicina e Farmácia" },
    { code: "INGENIERIAS", es: "Ingenierías", en: "Engineering", pt: "Engenharias" },
    { code: "RRHH_CAPACITACION", es: "Recursos Humanos y Capacitación", en: "Human Resources & Training", pt: "Recursos Humanos e Capacitação" },
    { code: "MARKETING_PUBLICIDAD", es: "Marketing y Publicidad", en: "Marketing & Advertising", pt: "Marketing e Publicidade" },
    { code: "ING_CIVIL_CONSTRUCCION", es: "Ingeniería Civil y Construcción", en: "Civil Engineering & Construction", pt: "Engenharia Civil e Construção" },
    { code: "LEGALES", es: "Legales", en: "Legal", pt: "Jurídico" },
    { code: "SECRETARIAS_RECEPCION", es: "Secretarias y Recepción", en: "Secretarial & Reception", pt: "Secretaria e Recepção" },
    { code: "DISENO", es: "Diseño", en: "Design", pt: "Design" },
    { code: "ADUANA_COMERCIO_EXTERIOR", es: "Aduana y Comercio Exterior", en: "Customs & Foreign Trade", pt: "Aduana e Comércio Exterior" },
    { code: "SEGUROS", es: "Seguros", en: "Insurance", pt: "Seguros" },
    { code: "GERENCIA_DIRECCION_GENERAL", es: "Gerencia y Dirección General", en: "Management & General Direction", pt: "Gerência e Diretoria Geral" },
    { code: "MINERIA_PETROLEO_GAS", es: "Minería, Petróleo y Gas", en: "Mining, Oil & Gas", pt: "Mineração, Petróleo e Gás" },
    { code: "DEPARTAMENTO_TECNICO", es: "Departamento Tecnico", en: "Technical Department", pt: "Departamento Técnico" },
    { code: "EDUCACION_DOCENCIA_INVESTIGACION", es: "Educación, Docencia e Investigación", en: "Education, Teaching & Research", pt: "Educação, Docência e Pesquisa" },
    { code: "COMUNICACION_RELACIONES_PUBLICAS", es: "Comunicación, Relaciones Institucionales y Públicas", en: "Communication, Institutional & Public Relations", pt: "Comunicação, Relações Institucionais e Públicas" },
    { code: "ENFERMERIA", es: "Enfermería", en: "Nursing", pt: "Enfermagem" },
    { code: "NAVIERA_MARITIMA_PORTUARIA", es: "Naviero, Maritimo, Portuario", en: "Shipping, Maritime & Port", pt: "Naval, Marítimo e Portuário" },
  ];

  const jobTypes = [
    { code: "FULL_TIME", es: "Tiempo completo", en: "Full-time", pt: "Tempo integral" },
    { code: "PART_TIME", es: "Medio tiempo", en: "Part-time", pt: "Meio período" },
    { code: "POR_HORAS", es: "Por horas", en: "Hourly", pt: "Por hora" },
    { code: "TEMPORARIO", es: "Temporario", en: "Temporary", pt: "Temporário" },
    { code: "PASANTIA", es: "Pasantía", en: "Internship", pt: "Estágio" },
    { code: "POR_CONTRATO", es: "Por contrato", en: "Contract", pt: "Contrato" },
    { code: "NOCTURNO", es: "Nocturno", en: "Night shift", pt: "Noturno" },
  ];

  const jobLevels = [
    { code: "SEMI_SR", es: "Semi Sr", en: "Mid-level", pt: "Pleno" },
    { code: "JUNIOR", es: "Junior", en: "Junior", pt: "Júnior" },
    { code: "SENIOR", es: "Senior", en: "Senior", pt: "Sênior" },
    { code: "SENIOR_O_SEMI_SENIOR", es: "Senior / Semi-Senior", en: "Senior / Mid-level", pt: "Sênior / Pleno" },
    { code: "JEFE_SUPERVISOR_RESPONSABLE", es: "Jefe / Supervisor / Responsable", en: "Lead / Supervisor / Manager", pt: "Chefe / Supervisor / Responsável" },
    { code: "OTRO", es: "Otro", en: "Other", pt: "Outro" },
    { code: "GERENCIA_ALTA_GERENCIA_DIRECCION", es: "Gerencia / Alta Gerencia / Dirección", en: "Management / Senior Management / Director", pt: "Gerência / Alta Gerência / Diretoria" },
    { code: "SIN_EXPERIENCIA", es: "Sin Experiencia", en: "No experience", pt: "Sem experiência" },
    { code: "TRAINEE_PASANTE", es: "Trainee / Pasante", en: "Trainee / Intern", pt: "Trainee / Estagiário" },
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

  console.log(`✅ Catálogos creados: ${jobAreas.length} áreas, ${jobTypes.length} tipos, ${jobLevels.length} niveles, ${modalities.length} modalidades`);
}
main().finally(() => prisma.$disconnect());
