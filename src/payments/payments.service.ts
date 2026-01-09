import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class PaymentsService {
  private baseURL: string;

  constructor(private configService: ConfigService) {
    const mode = this.configService.get("PAYPAL_MODE") || "sandbox";
    this.baseURL =
      mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
  }

  /**
   * Obtener credenciales de PayPal de forma lazy (cuando se necesiten)
   * Esto asegura que las credenciales de AWS Secrets Manager ya estén cargadas
   */
  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = this.configService.get("PAYPAL_CLIENT_ID");
    const clientSecret = this.configService.get("PAYPAL_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      const errorMessage =
        "Las credenciales de PayPal no están configuradas. Por favor, configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en las variables de entorno o en AWS Secrets Manager.";
      console.error(`❌ ${errorMessage}`);
      console.error(
        `PAYPAL_CLIENT_ID: ${clientId ? "✅ Configurado" : "❌ No configurado"}`
      );
      console.error(
        `PAYPAL_CLIENT_SECRET: ${
          clientSecret ? "✅ Configurado" : "❌ No configurado"
        }`
      );
      throw new Error(errorMessage);
    }

    return { clientId, clientSecret };
  }

  /**
   * Obtener token de acceso de PayPal
   */
  private async getAccessToken(): Promise<string> {
    // Obtener credenciales de forma lazy (cuando se necesiten)
    const { clientId, clientSecret } = this.getCredentials();

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64"
      );

      const response = await axios.post(
        `${this.baseURL}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return response.data.access_token;
    } catch (error: any) {
      console.error("Error getting PayPal access token:", error);

      // Mensaje de error más descriptivo
      if (error.response?.status === 401) {
        const errorMessage =
          "Error de autenticación con PayPal. Verifica que PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET sean correctos y estén configurados.";
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }

      throw new Error(
        `No se pudo autenticar con PayPal: ${
          error.response?.data?.error_description || error.message
        }`
      );
    }
  }

  /**
   * Crear una orden de pago
   */
  async createOrder(
    amount: number,
    currency = "USD",
    description = "Pago en TrabajoYa"
  ) {
    // Validar que la moneda sea soportada por PayPal
    // PayPal soporta: USD, EUR, GBP, CAD, AUD, JPY, y otras monedas principales
    // ARS (Pesos Argentinos) no está soportado en todos los entornos
    const supportedCurrencies = [
      "USD",
      "EUR",
      "GBP",
      "CAD",
      "AUD",
      "JPY",
      "MXN",
      "BRL",
    ];
    const normalizedCurrency = currency?.toUpperCase() || "USD";

    let validCurrency = normalizedCurrency;
    if (!supportedCurrencies.includes(normalizedCurrency)) {
      console.warn(
        `Moneda ${normalizedCurrency} no está en la lista de soportadas, usando USD por defecto`
      );
      validCurrency = "USD";
    }

    try {
      const accessToken = await this.getAccessToken();

      // Validar que FRONTEND_URL esté configurado
      const frontendUrl = this.configService.get<string>("FRONTEND_URL");
      if (!frontendUrl) {
        throw new Error(
          "FRONTEND_URL no está configurado. Por favor, configura FRONTEND_URL en las variables de entorno o en AWS Secrets Manager."
        );
      }

      const request = {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: validCurrency,
              value: amount.toFixed(2),
            },
            description,
          },
        ],
        application_context: {
          return_url: `${frontendUrl}/payment/success`,
          cancel_url: `${frontendUrl}/payment/cancel`,
          brand_name: "TrabajoYa",
          user_action: "PAY_NOW",
        },
      };

      const response = await axios.post(
        `${this.baseURL}/v2/checkout/orders`,
        request,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        orderId: response.data.id,
        status: response.data.status,
        links: response.data.links,
      };
    } catch (error: any) {
      console.error(
        "Error creating PayPal order:",
        error.response?.data || error
      );
      throw new Error("No se pudo crear la orden de pago");
    }
  }

  /**
   * Capturar el pago de una orden
   */
  async captureOrder(orderId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseURL}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        orderId: response.data.id,
        status: response.data.status,
        payer: response.data.payer,
        purchase_units: response.data.purchase_units,
      };
    } catch (error: any) {
      console.error(
        "Error capturing PayPal order:",
        error.response?.data || error
      );
      throw new Error("No se pudo capturar el pago");
    }
  }

  /**
   * Obtener detalles de una orden
   */
  async getOrderDetails(orderId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(
        "Error getting order details:",
        error.response?.data || error
      );
      throw new Error("No se pudo obtener los detalles de la orden");
    }
  }

  /**
   * Validar webhook de PayPal (básico)
   */
  async verifyWebhook(webhookId: string, headers: any, body: any) {
    try {
      // Por ahora retornamos true, implementar verificación real en producción
      console.log("Webhook received:", {
        event_type: body.event_type,
        resource: body.resource,
      });
      return true;
    } catch (error) {
      console.error("Error verifying webhook:", error);
      return false;
    }
  }
}
