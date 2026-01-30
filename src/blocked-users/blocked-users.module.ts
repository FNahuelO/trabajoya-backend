import { Module } from "@nestjs/common";
import { BlockedUsersController } from "./blocked-users.controller";
import { BlockedUsersService } from "./blocked-users.service";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * Módulo de bloqueo de usuarios
 * Implementa funcionalidad requerida por Google Play para cumplir con políticas de seguridad
 */
@Module({
  imports: [PrismaModule],
  controllers: [BlockedUsersController],
  providers: [BlockedUsersService],
  exports: [BlockedUsersService],
})
export class BlockedUsersModule {}




