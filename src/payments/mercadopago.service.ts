import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { randomUUID } from "crypto";

export interface MercadoPagoPreferenceResult {
  orderId: string;
  preferenceId: string;
  /** URL de checkout a abrir (sandbox o producción según el token) */
  initPoint: string;
  sandboxInitPoint?: string;
  testMode: boolean;
  amount: number;
  currency: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly client: MercadoPagoConfig | null;
  private readonly preferenceApi: Preference | null;
  private readonly paymentApi: Payment | null;
  private readonly testMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>("MERCADOPAGO_ACCESS_TOKEN");
    this.testMode = accessToken ? MercadoPagoService.isTestAccessToken(accessToken) : false;

    if (!accessToken) {
      this.logger.warn("MERCADOPAGO_ACCESS_TOKEN no configurado");
      this.client = null;
      this.preferenceApi = null;
      this.paymentApi = null;
      return;
    }

    if (this.testMode) {
      this.logger.log("Mercado Pago configurado en modo prueba (TEST access token)");
    }

    this.client = new MercadoPagoConfig({ accessToken });
    this.preferenceApi = new Preference(this.client);
    this.paymentApi = new Payment(this.client);
  }

  isTestMode(): boolean {
    return this.testMode;
  }

  private static isTestAccessToken(token: string): boolean {
    return token.trim().startsWith("TEST-");
  }

  private static checkoutHost(url: string | undefined): string | null {
    if (!url) return null;
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }

  private resolveCheckoutUrl(
    productionInitPoint: string | undefined,
    sandboxInitPoint: string | undefined
  ): string {
    if (this.testMode) {
      if (sandboxInitPoint) {
        return sandboxInitPoint;
      }
      if (productionInitPoint?.includes("sandbox.")) {
        return productionInitPoint;
      }
      this.logger.warn(
        "Token TEST sin sandbox_init_point de MP; usando init_point (puede mezclar entornos)"
      );
    }

    if (!productionInitPoint) {
      throw new Error("Mercado Pago no devolvió URL de checkout");
    }

    return productionInitPoint;
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

    const preferenceId = String(response.id);
    const productionInitPoint = response.init_point;
    const sandboxInitPoint = response.sandbox_init_point;
    const initPoint = this.resolveCheckoutUrl(productionInitPoint, sandboxInitPoint);

    this.logger.log(
      JSON.stringify({
        event: "mercadopago_preference_created",
        preferenceId,
        orderId,
        jobId: params.jobId,
        planId: params.planId ?? null,
        platform,
        amount: params.amount,
        currency: "ARS",
        testMode: this.testMode,
        checkoutHost: MercadoPagoService.checkoutHost(initPoint),
        productionHost: MercadoPagoService.checkoutHost(productionInitPoint),
        sandboxHost: MercadoPagoService.checkoutHost(sandboxInitPoint),
        notificationUrl: notificationUrl ?? null,
      })
    );

    return {
      orderId,
      preferenceId,
      initPoint,
      sandboxInitPoint,
      testMode: this.testMode,
      amount: params.amount,
      currency: "ARS",
    };
  }

  async getPaymentById(paymentId: string) {
    this.ensureConfigured();
    return this.paymentApi!.get({ id: paymentId });
  }
}
