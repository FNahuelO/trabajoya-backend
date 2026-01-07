import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      this.logger.log("🔌 Conectando a la base de datos...");
      await this.$connect();
      this.logger.log("✅ Conexión a la base de datos establecida");
      
      // Verificar estado de migraciones
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
          this.logger.warn(`⚠️  No se pudo verificar el estado de las migraciones: ${error?.message || "Error desconocido"}`);
        }
      }
    } catch (error) {
      this.logger.error("❌ Error al conectar con la base de datos:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log("🔌 Desconectando de la base de datos...");
    await this.$disconnect();
    this.logger.log("✅ Desconexión completada");
  }
}
