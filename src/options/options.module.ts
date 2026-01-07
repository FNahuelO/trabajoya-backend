import { Module } from "@nestjs/common";
import { OptionsController } from "./options.controller";
import { OptionsService } from "./options.service";
import { PrismaModule } from "../prisma/prisma.module";
import { CatalogsModule } from "../catalogs/catalogs.module";

@Module({
  imports: [PrismaModule, CatalogsModule],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
