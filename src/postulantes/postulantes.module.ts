import { Module, forwardRef } from "@nestjs/common";
import { PostulantesService } from "./postulantes.service";
import { PostulantesController } from "./postulantes.controller";
import { AtsService } from "./ats.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PostulantesController],
  providers: [AtsService, PostulantesService],
  exports: [AtsService, PostulantesService],
})
export class PostulantesModule {}
