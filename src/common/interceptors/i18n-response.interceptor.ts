import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { I18nContext } from "nestjs-i18n";

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const i18n = I18nContext.current(context);
    const lang = i18n?.lang || "es";

    return next.handle().pipe(
      map((data) => {
        // Si es una respuesta simple, la devuelve tal cual
        if (typeof data !== "object" || data === null) {
          return data;
        }

        // Agrega el idioma actual a la respuesta
        return {
          ...data,
          _lang: lang,
        };
      })
    );
  }
}
