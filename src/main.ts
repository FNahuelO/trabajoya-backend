import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import * as helmet from "helmet";

async function bootstrap() {
  console.log("🚀 Iniciando aplicación TrabajoYa...");
  console.log(`📅 Fecha: ${new Date().toISOString()}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);

  const app = await NestFactory.create(AppModule);

  // Security
  app.use(
    helmet.default({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["*"];

  // Función para normalizar el origin (remover barras finales y protocolos)
  const normalizeOrigin = (origin: string): string => {
    return origin.replace(/\/+$/, ""); // Remover barras finales
  };

  // Si no hay ALLOWED_ORIGINS configurado, permitir orígenes comunes
  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Permitir requests sin origin (ej: Postman, mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      // Si está configurado "*", permitir todo
      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // Verificar si el origin está en la lista permitida (normalizado y original)
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      // Permitir dominios relacionados con trabajo-ya.com (verificar en origin normalizado)
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
      if (
        process.env.NODE_ENV !== "production" &&
        normalizedOrigin.includes("localhost")
      ) {
        return callback(null, true);
      }

      console.warn(`🚫 CORS bloqueado para origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
      "Origin",
    ],
  };

  app.enableCors(corsOptions);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Swagger
  if (process.env.SWAGGER_ENABLED === "true") {
    const config = new DocumentBuilder()
      .setTitle("TrabajoYa API")
      .setDescription("API documentation for TrabajoYa platform")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api", app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log("=".repeat(50));
  console.log(`✅ Application is running on: http://localhost:${port}`);
  console.log(
    `📊 Swagger: ${
      process.env.SWAGGER_ENABLED === "true"
        ? `http://localhost:${port}/api`
        : "Deshabilitado"
    }`
  );
  console.log(
    `🌐 CORS: ${
      process.env.ALLOWED_ORIGINS || "Permitiendo todos los orígenes (*)"
    }`
  );
  console.log("=".repeat(50));
}

bootstrap();
