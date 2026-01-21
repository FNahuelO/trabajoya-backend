import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import * as helmet from "helmet";

async function bootstrap() {
  const startTime = Date.now();
  console.log("🚀 Iniciando aplicación TrabajoYa...");
  console.log(`📅 Fecha: ${new Date().toISOString()}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔌 Puerto configurado: ${process.env.PORT || 8080}`);

  try {
    console.log("📦 Creando aplicación NestJS...");
    const app = await NestFactory.create(AppModule, {
      // Optimizar para Cloud Run: iniciar más rápido
      logger: process.env.NODE_ENV === "production" 
        ? ["error", "warn", "log"] 
        : ["error", "warn", "log", "debug", "verbose"],
    });
    console.log(`⏱️  Aplicación creada en ${Date.now() - startTime}ms`);

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

    // Función para extraer el dominio del origin (sin protocolo, sin puerto)
    const extractDomain = (origin: string): string | null => {
      if (!origin) return null;
      try {
        const url = new URL(origin);
        return url.hostname.toLowerCase();
      } catch {
        // Si no es una URL válida, intentar extraer el dominio manualmente
        return origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "").split(":")[0].toLowerCase();
      }
    };

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
        const domain = extractDomain(origin);

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
            return callback(null, true);
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
          return callback(null, true);
        }

        // Permitir localhost en desarrollo
        if (
          process.env.NODE_ENV !== "production" &&
          domain &&
          (domain.includes("localhost") || domain.includes("127.0.0.1"))
        ) {
          return callback(null, true);
        }

        console.warn(`🚫 CORS bloqueado para origin: ${origin} (domain: ${domain})`);
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

    const port = parseInt(process.env.PORT || "8080", 10);
    
    // Cloud Run usa WebSocket upgrade automáticamente, pero necesitamos configurarlo
    // NestJS con Socket.IO funciona correctamente en Cloud Run sin cambios adicionales
    
    // Iniciar servidor de forma no bloqueante para que Cloud Run detecte el puerto rápidamente
    await app.listen(port, "0.0.0.0");
    
    console.log("=".repeat(50));
    console.log(`✅ Application is running on: http://0.0.0.0:${port}`);
    console.log(`✅ Server listening on port: ${port}`);
    console.log(`✅ Health check available at: http://0.0.0.0:${port}/health`);
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
  } catch (error) {
    console.error("❌ Error fatal al iniciar la aplicación:", error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error("❌ Error no manejado en bootstrap:", error);
  process.exit(1);
});
