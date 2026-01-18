import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const maxRetries = 5;
    const retryDelay = 2000; // 2 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`🔌 Conectando a la base de datos... (intento ${attempt}/${maxRetries})`);
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
        return; // Éxito, salir del bucle
      } catch (error: any) {
        if (attempt === maxRetries) {
          this.logger.error(`❌ Error al conectar con la base de datos después de ${maxRetries} intentos:`, error?.message || error);
          throw error;
        }
        this.logger.warn(`⚠️  Intento ${attempt} fallido, reintentando en ${retryDelay}ms... (${error?.message || "Error desconocido"})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async onModuleDestroy() {
    this.logger.log("🔌 Desconectando de la base de datos...");
    await this.$disconnect();
    this.logger.log("✅ Desconexión completada");
  }
}
