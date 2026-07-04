import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const SUPPORT_WHATSAPP_KEY = "support.whatsappNumber";
export const SUPPORT_EMAIL_KEY = "support.email";

// Fallbacks si no hay valor en DB ni en variables de entorno.
const DEFAULT_SUPPORT_WHATSAPP_NUMBER = "5491133902772";
const DEFAULT_SUPPORT_EMAIL = "soporte@trabajo-ya.com";

export interface SupportConfig {
  whatsappNumber: string;
  email: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getValue(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async setValue(key: string, value: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  /**
   * Devuelve la config de soporte. Prioridad: DB > variable de entorno > default.
   */
  async getSupportConfig(): Promise<SupportConfig> {
    const [whatsapp, email] = await Promise.all([
      this.getValue(SUPPORT_WHATSAPP_KEY),
      this.getValue(SUPPORT_EMAIL_KEY),
    ]);

    return {
      whatsappNumber: (
        whatsapp ??
        process.env.SUPPORT_WHATSAPP_NUMBER ??
        DEFAULT_SUPPORT_WHATSAPP_NUMBER
      ).trim(),
      email: (
        email ??
        process.env.SUPPORT_EMAIL ??
        DEFAULT_SUPPORT_EMAIL
      ).trim(),
    };
  }

  /**
   * Actualiza la config de soporte en DB. Solo toca los campos provistos.
   */
  async updateSupportConfig(input: {
    whatsappNumber?: string;
    email?: string;
  }): Promise<SupportConfig> {
    if (typeof input.whatsappNumber === "string") {
      // wa.me solo acepta dígitos: guardamos el número normalizado.
      await this.setValue(
        SUPPORT_WHATSAPP_KEY,
        input.whatsappNumber.replace(/\D/g, "")
      );
    }
    if (typeof input.email === "string") {
      await this.setValue(SUPPORT_EMAIL_KEY, input.email.trim());
    }
    return this.getSupportConfig();
  }
}
