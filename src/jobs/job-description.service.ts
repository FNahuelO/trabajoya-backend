import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PrismaService } from "../prisma/prisma.service";

export interface GenerateJobDescriptionDto {
  title: string;
  jobArea?: string;
  modality?: string;
  jobType?: string;
  experienceLevel?: string;
  location?: string;
  companyName?: string;
}

@Injectable()
export class JobDescriptionService {
  private readonly logger = new Logger(JobDescriptionService.name);
  private openai: OpenAI | null = null;
  private initializationAttempted = false;

  constructor(
    private configService: ConfigService,
    private subscriptionsService: SubscriptionsService,
    private prisma: PrismaService
  ) {
    // No inicializar aquí, esperar a que los secretos se carguen desde AWS
  }

  /**
   * Inicializar cliente de OpenAI de forma lazy
   * Se llama automáticamente cuando se necesita usar OpenAI
   */
  private ensureOpenAIIsInitialized() {
    // Si ya intentamos inicializar y no hay API key, no intentar de nuevo
    if (this.initializationAttempted) {
      return;
    }

    this.initializationAttempted = true;

    // Intentar obtener la API key desde ConfigService (que puede venir de AWS Secrets Manager)
    // o desde process.env directamente
    const apiKey =
      this.configService.get<string>("OPENAI_API_KEY") ||
      process.env.OPENAI_API_KEY;

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log(
        "✅ Cliente de OpenAI inicializado para generación de descripciones"
      );
    } else {
      this.logger.warn(
        "⚠️  OPENAI_API_KEY no configurada. La generación de descripciones no estará disponible."
      );
    }
  }

  /**
   * Verificar si el usuario tiene acceso a la generación de descripciones
   * Acceso disponible si:
   * 1. Tiene suscripción PREMIUM o ENTERPRISE, O
   * 2. Existe algún plan activo con hasAIFeature = true
   */
  async canGenerateDescription(empresaId: string): Promise<boolean> {
    // Verificar suscripción (compatibilidad con sistema anterior)
    const subscription = await this.subscriptionsService.getActiveSubscription(
      empresaId
    );
    if (subscription) {
      if (
        subscription.planType === "PREMIUM" ||
        subscription.planType === "ENTERPRISE"
      ) {
        return true;
      }
    }

    // Verificar si hay planes activos con funcionalidad de IA
    const plansWithAI = await this.prisma.plan.findFirst({
      where: {
        isActive: true,
        hasAIFeature: true,
      },
    });

    return !!plansWithAI;
  }

  /**
   * Generar descripción de trabajo usando OpenAI
   */
  async generateJobDescription(
    empresaId: string,
    dto: GenerateJobDescriptionDto
  ): Promise<{ description: string }> {
    // Verificar que el usuario tenga acceso
    const hasAccess = await this.canGenerateDescription(empresaId);
    if (!hasAccess) {
      throw new ForbiddenException(
        "Esta funcionalidad está disponible solo para planes PREMIUM, ENTERPRISE o planes con funcionalidad de IA habilitada"
      );
    }

    // Inicializar OpenAI si aún no se ha hecho (lazy initialization)
    this.ensureOpenAIIsInitialized();

    if (!this.openai) {
      throw new Error("OpenAI no está configurado");
    }

    try {
      // Construir el prompt sin incluir el título del puesto
      const contextParts: string[] = [];
      if (dto.jobArea) contextParts.push(`Área: ${dto.jobArea}`);
      if (dto.modality) contextParts.push(`Modalidad: ${dto.modality}`);
      if (dto.jobType) contextParts.push(`Tipo: ${dto.jobType}`);
      if (dto.experienceLevel) contextParts.push(`Nivel de experiencia: ${dto.experienceLevel}`);
      if (dto.location) contextParts.push(`Ubicación: ${dto.location}`);
      if (dto.companyName) contextParts.push(`Empresa: ${dto.companyName}`);

      const contextInfo = contextParts.length > 0 ? contextParts.join("\n") : "No se proporcionó información adicional.";

      const prompt = `Genera una descripción profesional y atractiva para una oferta de trabajo. La descripción debe ser clara, concisa y persuasiva.

Información del puesto:
${contextInfo}

La descripción debe incluir:
1. Una introducción atractiva sobre la posición
2. Responsabilidades principales (3-5 puntos)
3. Requisitos y habilidades necesarias (3-5 puntos)
4. Beneficios o ventajas de trabajar en esta posición (opcional, 2-3 puntos)
5. Una invitación a aplicar

IMPORTANTE:
- Formato: Texto continuo, sin viñetas ni listas numeradas. Párrafos bien estructurados.
- NO incluyas el título del puesto en la descripción.
- La descripción debe tener un máximo de 2000 caracteres.
- Solo genera el texto de la descripción, sin encabezados ni títulos.`;

      // Calcular max_tokens basado en 2000 caracteres (aproximadamente 500 tokens)
      // Usamos un factor conservador: ~4 caracteres por token
      const maxTokens = Math.floor(2000 / 4); // ~500 tokens para 2000 caracteres

      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>("OPENAI_MODEL") || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un experto en recursos humanos y redacción de ofertas de trabajo. Generas descripciones profesionales, claras y atractivas. IMPORTANTE: No incluyas el título del puesto en la descripción, solo genera el texto descriptivo.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7, // Un poco más creativo para descripciones
        max_tokens: maxTokens, // Limitado para asegurar máximo 2000 caracteres
      });

      let description = response.choices[0]?.message?.content?.trim();

      if (!description) {
        throw new Error("No se recibió respuesta de OpenAI");
      }

      // Asegurar que la descripción no supere los 2000 caracteres
      if (description.length > 2000) {
        description = description.substring(0, 2000).trim();
        // Intentar cortar en un punto o espacio para evitar cortar palabras
        const lastPeriod = description.lastIndexOf('.');
        const lastSpace = description.lastIndexOf(' ');
        const cutPoint = lastPeriod > 1800 ? lastPeriod + 1 : lastSpace > 1800 ? lastSpace : 2000;
        description = description.substring(0, cutPoint).trim();
      }

      return { description };
    } catch (error: any) {
      this.logger.error(
        `Error al generar descripción de trabajo: ${error?.message || error}`,
        error?.stack
      );
      throw new Error(`No se pudo generar la descripción: ${error.message}`);
    }
  }
}
