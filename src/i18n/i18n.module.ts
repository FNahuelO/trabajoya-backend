import { Module } from "@nestjs/common";
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from "nestjs-i18n";
import * as path from "path";

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: "es",
      loaderOptions: {
        // En producción usa dist/i18n/, en desarrollo usa src/i18n/
        path: path.join(
          process.cwd(),
          process.env.NODE_ENV === "production" ? "dist/i18n/" : "src/i18n/"
        ),
        watch: process.env.NODE_ENV !== "production",
      },
      resolvers: [
        { use: QueryResolver, options: ["lang"] },
        AcceptLanguageResolver,
        new HeaderResolver(["x-lang"]),
      ],
    }),
  ],
  exports: [I18nModule],
})
export class I18nCustomModule {}
