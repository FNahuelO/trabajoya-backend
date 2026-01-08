const { NestFactory } = require("@nestjs/core");
const { ExpressAdapter } = require("@nestjs/platform-express");
const express = require("express");
const helmet = require("helmet");
const { ValidationPipe } = require("@nestjs/common");
const { DocumentBuilder, SwaggerModule } = require("@nestjs/swagger");

let cachedApp;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  // Importar AppModule dinámicamente después del build
  const { AppModule } = require("../dist/app.module");

  const expressApp = express();

  // Configurar CORS antes de crear la app de NestJS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["*"];

  // Función para normalizar el origin (remover barras finales)
  const normalizeOrigin = (origin) => {
    return origin.replace(/\/+$/, ""); // Remover barras finales
  };

  // Función para verificar si un origin está permitido
  const isOriginAllowed = (origin) => {
    if (!origin) return true; // Permitir requests sin origin

    const normalizedOrigin = normalizeOrigin(origin);
    const isDevelopment = process.env.NODE_ENV !== "production";

    // Si está configurado "*", permitir todo
    if (allowedOrigins.includes("*")) {
      return true;
    }

    // En desarrollo, permitir todos los orígenes
    if (isDevelopment) {
      return true;
    }

    // Verificar si el origin está en la lista permitida
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      allowedOrigins.indexOf(normalizedOrigin) !== -1
    ) {
      return true;
    }

    // Permitir dominios relacionados con trabajo-ya.com
    const allowedDomains = [
      "trabajo-ya.com",
      "trabajoya.com",
      "trabajoya",
      "web.trabajo-ya.com",
      "api.trabajoya.com",
    ];

    const isAllowedDomain = allowedDomains.some((domain) =>
      normalizedOrigin.includes(domain)
    );

    if (isAllowedDomain) {
      return true;
    }

    // Permitir localhost en desarrollo
    if (isDevelopment && normalizedOrigin.includes("localhost")) {
      return true;
    }

    return false;
  };

  // Middleware manual para CORS (antes de NestJS)
  expressApp.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isOriginAllowed(origin)) {
      // Si hay origin, usarlo; si no, permitir todos (solo si no hay credentials)
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Accept-Language, X-Requested-With, Origin, Referer"
      );
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
    }

    // Manejar preflight requests
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  });

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      logger: false,
    }
  );

  // También habilitar CORS en NestJS
  const corsOptions = {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        const normalizedOrigin = normalizeOrigin(origin || "");
        console.warn(
          `🚫 CORS bloqueado para origin: ${origin} (normalized: ${normalizedOrigin})`
        );
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Accept-Language",
      "X-Requested-With",
      "Origin",
      "Referer",
    ],
    exposedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  app.enableCors(corsOptions);

  // Configurar helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Habilitar validación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Swagger API Documentation
  if (process.env.SWAGGER_ENABLED !== "false") {
    const config = new DocumentBuilder()
      .setTitle("TrabajoYa API")
      .setDescription("API para la plataforma de búsqueda de empleo TrabajoYa")
      .setVersion("1.0.0")
      .addBearerAuth()
      .addTag("auth", "Autenticación y gestión de usuarios")
      .addTag("jobs", "Gestión de empleos")
      .addTag("postulantes", "Gestión de postulantes")
      .addTag("empresas", "Gestión de empresas")
      .addTag("messages", "Mensajería entre usuarios")
      .addTag("upload", "Subida de archivos")
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, doc);
  }

  await app.init();
  cachedApp = expressApp;
  return expressApp;
}

module.exports = async (req, res) => {
  const app = await createApp();
  app(req, res);
};
