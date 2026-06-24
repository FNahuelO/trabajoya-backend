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
    // MP docs: en integración de prueba usar init_point (el token TEST enruta al sandbox).
    // sandbox_init_point usa otro flujo (/checkout/v1/redirect/.../login) que suele buclear.
    if (productionInitPoint) {
      return productionInitPoint;
    }

    if (this.testMode && sandboxInitPoint) {
      this.logger.warn("init_point ausente; usando sandbox_init_point como fallback");
      return sandboxInitPoint;
    }

    throw new Error("Mercado Pago no devolvió URL de checkout");
  }

  private getTestPayerEmail(): string | undefined {
    if (!this.testMode) return undefined;
    const email = this.configService.get<string>("MERCADOPAGO_TEST_PAYER_EMAIL")?.trim();
    return email || undefined;
  }

  hasTestPayerEmail(): boolean {
    return !!this.getTestPayerEmail();
  }

  private getNotificationUrl(): string | undefined {
    const explicitUrl = this.configService.get<string>("MERCADOPAGO_NOTIFICATION_URL")?.trim();
    if (explicitUrl) {
      return explicitUrl.replace(/\/$/, "");
    }

    const backendUrl = this.testMode
      ? this.configService.get<string>("MERCADOPAGO_TEST_BACKEND_URL")?.trim() ||
        this.configService.get<string>("BACKEND_URL") ||
        this.configService.get<string>("API_URL") ||
        ""
      : this.configService.get<string>("BACKEND_URL") ||
        this.configService.get<string>("API_URL") ||
        "";

    if (!backendUrl) return undefined;
    return `${backendUrl.replace(/\/$/, "")}/api/payments/mercadopago/webhook`;
  }

  private getWebEmpresasBaseUrl(): string {
    if (this.testMode) {
      return (
        this.configService.get<string>("MERCADOPAGO_TEST_WEB_EMPRESAS_URL") ||
        this.configService.get<string>("WEB_EMPRESAS_URL") ||
        this.configService.get<string>("FRONTEND_URL") ||
        ""
      ).replace(/\/$/, "");
    }

    return (
      this.configService.get<string>("WEB_EMPRESAS_URL") ||
      this.configService.get<string>("FRONTEND_URL") ||
      ""
    ).replace(/\/$/, "");
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
      const webBase = this.getWebEmpresasBaseUrl();
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

  private buildTestPaymentMethods() {
    // MP no permite excluir account_money (la API responde "account_money cannot be excluded").
    // En sandbox, el comprador debe elegir tarjeta de prueba y no "dinero en cuenta".
    return {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      installments: 1,
      default_installments: 1,
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
    const backUrls = this.buildBackUrls(params.jobId, orderId, platform, params.fromApp);
    const notificationUrl = this.getNotificationUrl();
    const concept = `JOB:${params.jobId} | ORDER:${orderId}`;
    const testPayerEmail = this.getTestPayerEmail();

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
        ...(this.testMode
          ? {}
          : { auto_return: "approved" as const }),
        ...(testPayerEmail ? { payer: { email: testPayerEmail } } : {}),
        ...(this.testMode
          ? { payment_methods: this.buildTestPaymentMethods() }
          : {}),
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
        checkoutUrlKind: productionInitPoint ? "init_point" : "sandbox_init_point_fallback",
        checkoutHost: MercadoPagoService.checkoutHost(initPoint),
        productionHost: MercadoPagoService.checkoutHost(productionInitPoint),
        sandboxHost: MercadoPagoService.checkoutHost(sandboxInitPoint),
        backUrls,
        testPayerEmail: testPayerEmail ?? null,
        paymentMethods: this.testMode ? this.buildTestPaymentMethods() : null,
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
