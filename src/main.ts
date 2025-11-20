import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configurar CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:19006"];

  const isDevelopment = process.env.NODE_ENV !== "production";

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, postman, etc)
      if (!origin) {
        console.log("[CORS] Request sin origin permitido (mobile app)");
        return callback(null, true);
      }

      // En desarrollo, permitir todos los orígenes
      if (isDevelopment) {
        console.log(`[CORS] Origen permitido en desarrollo: ${origin}`);
        return callback(null, true);
      }

      // En producción, verificar lista de orígenes permitidos
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Origen bloqueado: ${origin}`);
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
    ],
  });

  // Configurar helmet con excepciones para uploads
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Servir archivos estáticos
  app.useStaticAssets(join(process.cwd(), "uploads"), {
    prefix: "/uploads/",
  });

  // Habilitar validación básica
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

  const port = process.env.PORT || 4000;
  await app.listen(port, "0.0.0.0");

  console.log(`✅ API lista en http://localhost:${port}`);
  console.log(`✅ API accesible en http://0.0.0.0:${port}`);
  console.log(`📚 Documentación: http://localhost:${port}/api/docs`);
  console.log(
    `🌐 CORS: ${
      isDevelopment ? "Permisivo (desarrollo)" : "Restrictivo (producción)"
    }`
  );
}
bootstrap();
