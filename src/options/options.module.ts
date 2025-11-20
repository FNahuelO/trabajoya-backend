import { Module } from "@nestjs/common";
import { OptionsController } from "./options.controller";
import { OptionsService } from "./options.service";
import { I18nCustomModule } from "../i18n/i18n.module";

@Module({
  imports: [I18nCustomModule],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
