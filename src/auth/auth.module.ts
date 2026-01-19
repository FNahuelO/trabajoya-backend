import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { I18nCustomModule } from "../i18n/i18n.module";
import { MailModule } from "../mail/mail.module";
import { TermsModule } from "../terms/terms.module";

@Module({
  imports: [
    PassportModule,
    I18nCustomModule,
    MailModule,
    TermsModule,
    JwtModule.register({
      // En Cloud Run, el secreto puede ser inyectado por Secret Manager luego del bootstrap.
      // JwtStrategy valida el token con secretOrKeyProvider (runtime), así que acá ponemos
      // un fallback para evitar crash al iniciar.
      secret: process.env.JWT_ACCESS_SECRET || "temporary-startup-secret",
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
