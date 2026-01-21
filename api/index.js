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

  // Función para extraer el dominio del origin (sin protocolo, sin puerto)
  const extractDomain = (origin) => {
    if (!origin) return null;
    try {
      const url = new URL(origin);
      return url.hostname.toLowerCase();
    } catch {
      // Si no es una URL válida, intentar extraer el dominio manualmente
      return origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "").split(":")[0].toLowerCase();
    }
  };

  // Función para normalizar el origin (remover barras finales)
  const normalizeOrigin = (origin) => {
    return origin.replace(/\/+$/, ""); // Remover barras finales
  };

  // Función para verificar si un origin está permitido
  const isOriginAllowed = (origin) => {
    if (!origin) return true; // Permitir requests sin origin

    const normalizedOrigin = normalizeOrigin(origin);
    const domain = extractDomain(origin);
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

    // Permitir dominios relacionados con trabajoya.com (incluyendo subdominios)
    const allowedDomainPatterns = [
      /^([a-z0-9-]+\.)?trabajoya\.com$/,
      /^([a-z0-9-]+\.)?trabajo-ya\.com$/,
      /^localhost$/,
      /^127\.0\.0\.1$/,
    ];

    if (domain) {
      const isAllowedDomain = allowedDomainPatterns.some((pattern) =>
        pattern.test(domain)
      );

      if (isAllowedDomain) {
        return true;
      }
    }

    // Verificación adicional por si acaso (backward compatibility)
    const allowedDomains = [
      "trabajo-ya.com",
      "trabajoya.com",
      "trabajoya",
      "web.trabajo-ya.com",
      "web.trabajoya.com",
      "www.trabajoya.com",
      "www.trabajo-ya.com",
      "api.trabajoya.com",
    ];

    const isAllowedDomainLegacy = allowedDomains.some((allowedDomain) =>
      domain && domain.includes(allowedDomain.replace(/^https?:\/\//, "").split("/")[0])
    );

    if (isAllowedDomainLegacy) {
      return true;
    }

    // Permitir localhost en desarrollo
    if (isDevelopment && domain && (domain.includes("localhost") || domain.includes("127.0.0.1"))) {
      return true;
    }

    return false;
  };

  // Middleware manual para CORS (antes de NestJS)
  expressApp.use((req, res, next) => {
    const origin = req.headers.origin;

    // Manejar preflight requests primero
    if (req.method === "OPTIONS") {
      if (isOriginAllowed(origin)) {
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
        return res.status(204).end();
      } else {
        // Si el origin no está permitido, aún responder al OPTIONS pero sin headers CORS
        return res.status(204).end();
      }
    }

    // Para requests normales, configurar CORS si el origin está permitido
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
        const domain = extractDomain(origin || "");
        console.log(`✅ CORS permitido para origin: ${origin} (domain: ${domain})`);
        callback(null, true);
      } else {
        const normalizedOrigin = normalizeOrigin(origin || "");
        const domain = extractDomain(origin || "");
        console.warn(
          `🚫 CORS bloqueado para origin: ${origin} (normalized: ${normalizedOrigin}, domain: ${domain})`
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
