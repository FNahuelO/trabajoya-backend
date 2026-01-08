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
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      logger: false,
    }
  );

  // Configurar CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["*"];

  // Función para normalizar el origin (remover barras finales)
  const normalizeOrigin = (origin) => {
    return origin.replace(/\/+$/, ""); // Remover barras finales
  };

  const isDevelopment = process.env.NODE_ENV !== "production";

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, postman, etc)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      // Si está configurado "*", permitir todo
      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // En desarrollo, permitir todos los orígenes
      if (isDevelopment) {
        return callback(null, true);
      }

      // Verificar si el origin está en la lista permitida (normalizado y original)
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.indexOf(normalizedOrigin) !== -1
      ) {
        return callback(null, true);
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
        return callback(null, true);
      }

      // Permitir localhost en desarrollo
      if (isDevelopment && normalizedOrigin.includes("localhost")) {
        return callback(null, true);
      }

      console.warn(`🚫 CORS bloqueado para origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
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
    ],
  });

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
