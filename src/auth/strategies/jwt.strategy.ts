import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Importante para Cloud Run + Secret Manager:
      // los secrets pueden cargarse después del bootstrap, así que NO podemos
      // exigir el secret en el constructor (si no, el contenedor crashea).
      // Lo resolvemos por request leyendo de env/config en runtime.
      secretOrKeyProvider: (
        _request: Request,
        _rawJwtToken: string,
        done: (err: any, secret?: string) => void
      ) => {
        const secret =
          this.configService.get<string>("JWT_ACCESS_SECRET") ||
          process.env.JWT_ACCESS_SECRET;

        if (!secret) {
          // No crashear el server: devolver error de auth.
          return done(new Error("JWT_ACCESS_SECRET no está configurado"));
        }

        return done(null, secret);
      },
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      userType: payload.userType,
    };
  }
}
