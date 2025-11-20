import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";

export const Lang = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const i18n = I18nContext.current(ctx);
    return i18n?.lang || "es";
  }
);
