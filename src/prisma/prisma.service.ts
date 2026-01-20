import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // CRÍTICO: Pasar la URL explícitamente para que se evalúe en runtime
    // Esto asegura que DATABASE_URL se lea cuando NestJS instancia el servicio,
    // no cuando se compila el código
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      // Log de error detallado para debugging
      const availableEnvVars = Object.keys(process.env)
        .filter(key => key.includes('DATABASE') || key.includes('PRISMA'))
        .join(', ');
      
      throw new Error(
        `❌ DATABASE_URL no está definida en las variables de entorno.\n` +
        `Variables relacionadas disponibles: ${availableEnvVars || 'ninguna'}\n` +
        `Esto puede indicar que Cloud Run no está montando los secretos correctamente.`
      );
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      // Opciones adicionales para Cloud Run
      log: process.env.NODE_ENV === 'production' 
        ? ['error', 'warn']
        : ['query', 'error', 'warn'],
    });

    this.logger.log('✅ PrismaClient inicializado con DATABASE_URL desde variables de entorno');
  }

  async onModuleInit() {
    // Conectar a la BD de forma asíncrona sin bloquear el inicio del servidor
    // En Cloud Run, es crítico que el servidor escuche en el puerto rápidamente
    this.connectWithRetry().catch((error) => {
      this.logger.error("Error crítico conectando a la base de datos:", error);
      // No lanzar el error para permitir que el servidor inicie
      // Las queries fallarán pero el servidor estará disponible
    });
  }

  private async connectWithRetry() {
    const maxRetries = 5;
    const retryDelay = 2000; // 2 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`🔌 Conectando a la base de datos... (intento ${attempt}/${maxRetries})`);
        await this.$connect();
        this.logger.log("✅ Conexión a la base de datos establecida");
        
        // Verificar estado de migraciones (en background, no crítico)
        this.checkMigrations().catch((error) => {
          this.logger.debug("No se pudo verificar migraciones:", error);
        });
        
        return; // Éxito, salir del bucle
      } catch (error: any) {
        if (attempt === maxRetries) {
          this.logger.error(
            `❌ Error al conectar con la base de datos después de ${maxRetries} intentos:`,
            error?.message || error
          );
          // No lanzar el error, permitir que el servidor continúe
          // La conexión se reintentará en la primera query
          return;
        }
        this.logger.warn(
          `⚠️  Intento ${attempt} fallido, reintentando en ${retryDelay}ms... ` +
          `(${error?.message || "Error desconocido"})`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  private async checkMigrations() {
    try {
      const result = await this.$queryRawUnsafe<Array<{ migration_name: string }>>(
        `SELECT migration_name FROM _prisma_migrations 
         WHERE finished_at IS NOT NULL
         ORDER BY finished_at DESC 
         LIMIT 5`
      );
      this.logger.log(`📦 Últimas migraciones aplicadas: ${result.length} encontradas`);
      if (result.length > 0) {
        this.logger.log(`   Última migración: ${result[0].migration_name}`);
      }
    } catch (error: any) {
      // Ignorar errores si la tabla no existe aún (primera vez)
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