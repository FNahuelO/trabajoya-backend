import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { randomUUID } from "crypto";

export interface MercadoPagoPreferenceResult {
  orderId: string;
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint?: string;
  amount: number;
  currency: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly client: MercadoPagoConfig | null;
  private readonly preferenceApi: Preference | null;
  private readonly paymentApi: Payment | null;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      this.logger.warn("MERCADOPAGO_ACCESS_TOKEN no configurado");
      this.client = null;
      this.preferenceApi = null;
      this.paymentApi = null;
      return;
    }

    this.client = new MercadoPagoConfig({ accessToken });
    this.preferenceApi = new Preference(this.client);
    this.paymentApi = new Payment(this.client);
  }

  private ensureConfigured() {
    if (!this.preferenceApi || !this.paymentApi) {
      throw new Error(
        "Mercado Pago no está configurado. Definí MERCADOPAGO_ACCESS_TOKEN en las variables de entorno."
      );
    }
  }

  private buildBackUrls(
    jobId: string,
    orderId: string,
    platform: "mobile" | "web",
    fromApp?: boolean
  ): { success: string; failure: string; pending: string } {
    const queryParts = [
      `jobId=${encodeURIComponent(jobId)}`,
      `orderId=${encodeURIComponent(orderId)}`,
    ];
    if (fromApp) {
      queryParts.push("fromApp=1");
    }
    const query = queryParts.join("&");

    if (platform === "web") {
      const webBase = (
        this.configService.get<string>("WEB_EMPRESAS_URL") ||
        this.configService.get<string>("FRONTEND_URL") ||
        ""
      ).replace(/\/$/, "");
      const prefix = webBase ? `${webBase}/payment` : "/payment";
      return {
        success: `${prefix}/success?${query}`,
        failure: `${prefix}/failure?${query}`,
        pending: `${prefix}/pending?${query}`,
      };
    }

    const appScheme = this.configService.get<string>("APP_DEEP_LINK_SCHEME") || "trabajoya";
    return {
      success: `${appScheme}://payment/success?${query}`,
      failure: `${appScheme}://payment/failure?${query}`,
      pending: `${appScheme}://payment/pending?${query}`,
    };
  }

  async createPreference(params: {
    amount: number;
    title: string;
    jobId: string;
    orderId?: string;
    planId?: string | null;
    userId?: string;
    platform?: "mobile" | "web";
    fromApp?: boolean;
  }): Promise<MercadoPagoPreferenceResult> {
    this.ensureConfigured();

    const orderId = params.orderId || randomUUID();
    const platform = params.platform || "mobile";
    const backendUrl =
      this.configService.get<string>("BACKEND_URL") ||
      this.configService.get<string>("API_URL") ||
      "";
    const backUrls = this.buildBackUrls(params.jobId, orderId, platform, params.fromApp);

    const notificationUrl = backendUrl
      ? `${backendUrl.replace(/\/$/, "")}/api/payments/mercadopago/webhook`
      : undefined;

    const concept = `JOB:${params.jobId} | ORDER:${orderId}`;

    const response = await this.preferenceApi!.create({
      body: {
        items: [
          {
            id: params.planId || params.jobId,
            title: params.title,
            quantity: 1,
            unit_price: params.amount,
            currency_id: "ARS",
          },
        ],
        external_reference: orderId,
        metadata: {
          jobId: params.jobId,
          orderId,
          planId: params.planId || null,
          userId: params.userId || null,
          concept,
        },
        back_urls: backUrls,
        auto_return: "approved",
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      },
    });

    const initPoint = response.init_point;
    if (!initPoint) {
      throw new Error("Mercado Pago no devolvió URL de checkout");
    }

    return {
      orderId,
      preferenceId: String(response.id),
      initPoint,
      sandboxInitPoint: response.sandbox_init_point,
      amount: params.amount,
      currency: "ARS",
    };
  }

  async getPaymentById(paymentId: string) {
    this.ensureConfigured();
    return this.paymentApi!.get({ id: paymentId });
  }
}
