import { Module } from "@nestjs/common";
import { FavoritesService } from "./favorites.service";
import { FavoritesController } from "./favorites.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
