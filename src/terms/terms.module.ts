import { Module } from "@nestjs/common";
import { TermsController } from "./terms.controller";
import { TermsService } from "./terms.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
