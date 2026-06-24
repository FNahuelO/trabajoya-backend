import { BadRequestException } from "@nestjs/common";
import * as crypto from "crypto";

const ALLOWED_RETURN_PREFIXES = ["/publicaciones", "/payment", "/planes", "/dashboard"];

export function sanitizeWebHandoffReturnPath(returnPath: string): string {
  const trimmed = returnPath.trim();
  if (!trimmed.startsWith("/")) {
    throw new BadRequestException("returnPath inválido");
  }
  if (trimmed.includes("://") || trimmed.includes("..") || trimmed.includes("\\")) {
    throw new BadRequestException("returnPath inválido");
  }
  if (trimmed.length > 512) {
    throw new BadRequestException("returnPath demasiado largo");
  }

  const pathOnly = trimmed.split("?")[0];
  const allowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  );
  if (!allowed) {
    throw new BadRequestException("returnPath no permitido");
  }

  return trimmed;
}

export function generateWebHandoffCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashWebHandoffCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
