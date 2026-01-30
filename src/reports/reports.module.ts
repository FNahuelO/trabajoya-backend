import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * Módulo de denuncias
 * Implementa funcionalidad requerida por Google Play para cumplir con políticas de seguridad
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}




