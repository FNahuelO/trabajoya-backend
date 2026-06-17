import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./database-url.util";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private databaseUrl: string;

  constructor() {
    const databaseUrl = normalizeDatabaseUrl(
      process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL
    );

    if (!databaseUrl) {
      const availableEnvVars = Object.keys(process.env)
        .filter((key) => key.includes("DATABASE") || key.includes("PRISMA"))
        .join(", ");

      throw new Error(
        `❌ PRISMA_DATABASE_URL ni DATABASE_URL están definidas.\n` +
          `Variables relacionadas disponibles: ${availableEnvVars || "ninguna"}`
      );
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log:
        process.env.NODE_ENV === "production"
          ? ["error", "warn"]
          : ["query", "error", "warn"],
    });

    this.databaseUrl = databaseUrl;
    const host = databaseUrl.split("@")[1]?.split("/")[0] || "desconocido";
    this.logger.log(`✅ PrismaClient inicializado (host: ${host})`);
  }

  async onModuleInit() {
    // No bloquear app.listen(): la conexión a DB corre en background
    void this.connectWithRetry().catch((error) => {
      this.logger.error("Error crítico conectando a la base de datos:", error);
    });
  }

  private async connectWithRetry() {
    const maxRetries = 5;
    const retryDelay = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `🔌 Conectando a la base de datos... (intento ${attempt}/${maxRetries})`
        );
        await this.$connect();
        this.logger.log("✅ Conexión a la base de datos establecida");

        this.checkMigrations().catch((error) => {
          this.logger.debug("No se pudo verificar migraciones:", error);
        });

        return;
      } catch (error: any) {
        try {
          await this.$disconnect();
        } catch {
          // Ignorar errores al desconectar un pool colgado
        }

        if (attempt === maxRetries) {
          this.logger.error(
            `❌ Error al conectar con la base de datos después de ${maxRetries} intentos:`,
            error?.message || error
          );
          return;
        }

        this.logger.warn(
          `⚠️  Intento ${attempt} fallido, reintentando en ${retryDelay}ms... ` +
            `(${error?.message || "Error desconocido"})`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  private async checkMigrations() {
    try {
      const result = await this.$queryRawUnsafe<
        Array<{ migration_name: string }>
      >(
        `SELECT migration_name FROM _prisma_migrations 
         WHERE finished_at IS NOT NULL
         ORDER BY finished_at DESC 
         LIMIT 5`
      );
      this.logger.log(
        `📦 Últimas migraciones aplicadas: ${result.length} encontradas`
      );
      if (result.length > 0) {
        this.logger.log(`   Última migración: ${result[0].migration_name}`);
      }
    } catch (error: any) {
      if (error?.code !== "42P01") {
        this.logger.warn(
          `⚠️  No se pudo verificar el estado de las migraciones: ` +
            `${error?.message || "Error desconocido"}`
        );
      }
    }
  }

  async onModuleDestroy() {
    this.logger.log("🔌 Desconectando de la base de datos...");
    await this.$disconnect();
    this.logger.log("✅ Desconexión completada");
  }
}
