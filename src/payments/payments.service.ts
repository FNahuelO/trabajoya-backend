import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class PaymentsService {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;

  constructor(private configService: ConfigService) {
    const mode = this.configService.get("PAYPAL_MODE") || "sandbox";
    this.baseURL =
      mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    this.clientId = this.configService.get("PAYPAL_CLIENT_ID");
    this.clientSecret = this.configService.get("PAYPAL_CLIENT_SECRET");
  }

  /**
   * Obtener token de acceso de PayPal
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");

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
    } catch (error) {
      console.error("Error getting PayPal access token:", error);
      throw new Error("No se pudo autenticar con PayPal");
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
    try {
      const accessToken = await this.getAccessToken();

      const request = {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            description,
          },
        ],
        application_context: {
          return_url: `${this.configService.get(
            "FRONTEND_URL"
          )}/payment/success`,
          cancel_url: `${this.configService.get(
            "FRONTEND_URL"
          )}/payment/cancel`,
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
