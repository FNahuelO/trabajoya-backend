import * as crypto from "crypto";

export class MercadoPagoWebhookSignatureError extends Error {
  constructor(
    public readonly reason:
      | "SECRET_NOT_CONFIGURED"
      | "MISSING_SIGNATURE"
      | "INVALID_SIGNATURE_HEADER"
      | "TIMESTAMP_OUT_OF_TOLERANCE"
      | "SIGNATURE_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "MercadoPagoWebhookSignatureError";
  }
}

export interface MercadoPagoWebhookSignatureInput {
  xSignature: string | string[] | undefined;
  xRequestId: string | string[] | undefined;
  dataId: string | string[] | undefined;
  secret: string;
  /** Tolerancia del timestamp del header (ms). 0 desactiva la validación temporal. */
  maxAgeMs?: number;
}

function normalizeDataId(dataId: string): string {
  if (/^[a-z0-9]+$/i.test(dataId)) {
    return dataId.toLowerCase();
  }
  return dataId;
}

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const joined = value.map((part) => String(part).trim()).filter(Boolean).join(", ");
    return joined || undefined;
  }
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

/** MP documenta ts en ms; algunas notificaciones legacy envían segundos Unix (~10 dígitos). */
function parseWebhookTimestampMs(ts: string): number {
  const n = Number(ts);
  if (!Number.isFinite(n)) return NaN;
  return n < 1e12 ? n * 1000 : n;
}

function parseSignatureHeader(xSignature: string): { ts: string; v1: string } {
  const parts = Object.fromEntries(
    xSignature.split(",").map((segment) => {
      const trimmed = segment.trim();
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        return [trimmed, ""];
      }
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      return [key, value];
    })
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    throw new MercadoPagoWebhookSignatureError(
      "INVALID_SIGNATURE_HEADER",
      "Header x-signature inválido"
    );
  }

  return { ts, v1 };
}

function buildSignatureManifest(ts: string, xRequestId?: string, dataId?: string): string {
  const chunks: string[] = [];
  if (dataId) {
    chunks.push(`id:${normalizeDataId(dataId)};`);
  }
  if (xRequestId) {
    chunks.push(`request-id:${xRequestId};`);
  }
  chunks.push(`ts:${ts};`);
  return chunks.join("");
}

/**
 * Valida la firma HMAC-SHA256 de una notificación webhook de Mercado Pago.
 * @see https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function validateMercadoPagoWebhookSignature(
  input: MercadoPagoWebhookSignatureInput
): void {
  const secret = input.secret?.trim();
  if (!secret) {
    throw new MercadoPagoWebhookSignatureError(
      "SECRET_NOT_CONFIGURED",
      "MERCADOPAGO_WEBHOOK_SECRET no configurado"
    );
  }

  const xSignature = normalizeHeaderValue(input.xSignature);
  if (!xSignature) {
    throw new MercadoPagoWebhookSignatureError(
      "MISSING_SIGNATURE",
      "Falta el header x-signature"
    );
  }

  const rawDataId = Array.isArray(input.dataId) ? input.dataId[0] : input.dataId;
  const dataId = rawDataId != null ? String(rawDataId).trim() : undefined;
  const xRequestId = normalizeHeaderValue(input.xRequestId);

  const { ts, v1 } = parseSignatureHeader(xSignature);

  const maxAgeMs = input.maxAgeMs ?? 5 * 60 * 1000;
  if (maxAgeMs > 0) {
    const tsMs = parseWebhookTimestampMs(ts);
    const driftMs = Number.isFinite(tsMs) ? Math.abs(Date.now() - tsMs) : Infinity;
    if (!Number.isFinite(tsMs) || driftMs > maxAgeMs) {
      throw new MercadoPagoWebhookSignatureError(
        "TIMESTAMP_OUT_OF_TOLERANCE",
        `Timestamp del webhook fuera de tolerancia (ts=${ts}, driftMs=${driftMs}, maxAgeMs=${maxAgeMs})`
      );
    }
  }

  const manifest = buildSignatureManifest(ts, xRequestId, dataId || undefined);
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const expected = Buffer.from(v1, "utf8");
  const actual = Buffer.from(computed, "utf8");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new MercadoPagoWebhookSignatureError(
      "SIGNATURE_MISMATCH",
      "Firma de webhook inválida"
    );
  }
}

export function resolveMercadoPagoWebhookDataId(
  query: Record<string, unknown> | undefined,
  body: { data?: { id?: string | number }; id?: string | number } | undefined
): string | undefined {
  const fromQuery = query?.["data.id"] ?? query?.id;
  if (fromQuery != null && String(fromQuery).trim()) {
    return String(fromQuery).trim();
  }
  if (body?.data?.id != null) {
    return String(body.data.id).trim();
  }
  if (body?.id != null) {
    return String(body.id).trim();
  }
  return undefined;
}
