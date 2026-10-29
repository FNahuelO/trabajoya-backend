import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ModerationTermCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export enum ModerationSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ModerationResult {
  isApproved: boolean;
  needsManualReview: boolean;
  severity: ModerationSeverity;
  reasons: string[];
  flaggedWords: string[];
  score: number; // 0-100, donde 0 es completamente seguro
  suggestions?: string[];
}

interface CategoryRule {
  score: number;
  severity: ModerationSeverity;
  reason: string;
  suggestion?: string;
}

const CATEGORY_RULES: Record<ModerationTermCategory, CategoryRule> = {
  SCAM: {
    score: 40,
    severity: ModerationSeverity.CRITICAL,
    reason: "Posible contenido de estafa o fraude detectado",
    suggestion: "Evita promesas de ganancias o menciones de esquemas de inversión",
  },
  EXPLOITATION: {
    score: 35,
    severity: ModerationSeverity.HIGH,
    reason: "Posible explotación laboral detectada",
    suggestion: "Especifica claramente el salario y las condiciones laborales",
  },
  DISCRIMINATION: {
    score: 30,
    severity: ModerationSeverity.HIGH,
    reason: "Contenido discriminatorio detectado",
    suggestion: "Evita mencionar género, edad, estado civil o apariencia física",
  },
  OFFENSIVE: {
    score: 45,
    severity: ModerationSeverity.CRITICAL,
    reason: "Lenguaje ofensivo o inapropiado detectado",
  },
  INAPPROPRIATE: {
    score: 50,
    severity: ModerationSeverity.CRITICAL,
    reason: "Oferta laboral inapropiada o ilegal detectada",
  },
};

const CATEGORY_ORDER: ModerationTermCategory[] = [
  "SCAM",
  "EXPLOITATION",
  "DISCRIMINATION",
  "OFFENSIVE",
  "INAPPROPRIATE",
];

// Se usa solo si la tabla ModerationTerm todavía no se pudo leer.
const FALLBACK_TERMS: Array<{ term: string; category: ModerationTermCategory }> = [
  ...["dinero fácil", "gana dinero rápido", "inversión inicial", "multinivel", "piramidal",
    "ganancias garantizadas", "mlm", "ganar dinero sin trabajar", "negocio propio sin inversión",
    "ingresos pasivos fáciles", "hazte rico"].map((term) => ({ term, category: "SCAM" as const })),
  ...["sin pago", "trabajo gratis", "sin sueldo", "trabajo voluntario obligatorio",
    "trabajo sin remuneración", "pago en especie", "trabajo informal", "sin contrato"]
    .map((term) => ({ term, category: "EXPLOITATION" as const })),
  ...["solo hombres", "solo mujeres", "edad máxima", "solo jóvenes", "no mayores de",
    "preferentemente hombres", "preferentemente mujeres", "buena presencia", "físico agradable",
    "estado civil", "sin hijos", "soltera", "soltero"]
    .map((term) => ({ term, category: "DISCRIMINATION" as const })),
  ...["idiota", "imbécil", "estúpido", "tonto", "retrasado", "inútil", "pendejo", "hijo de puta",
    "mierda", "carajo"].map((term) => ({ term, category: "OFFENSIVE" as const })),
  ...["envía dinero", "modelo webcam", "trabajo sexual", "acompañante vip", "dama de compañía",
    "masajista sensual", "servicios para adultos", "entretenimiento adulto", "contenido adulto"]
    .map((term) => ({ term, category: "INAPPROPRIATE" as const })),
];

interface CompiledTerm {
  term: string;
  category: ModerationTermCategory;
  regex: RegExp;
}

const TERMS_TTL_MS = 60_000;

// Compartido entre todas las instancias del servicio (cada módulo crea la suya).
let termsCache: { terms: CompiledTerm[]; loadedAt: number } | null = null;
let termsLoading: Promise<void> | null = null;

/** Minúsculas, sin tildes y con espacios simples, para comparar texto. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compileTerm(term: string, category: ModerationTermCategory): CompiledTerm {
  const escaped = normalizeText(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
  return {
    term,
    category,
    regex: new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u"),
  };
}

@Injectable()
export class ContentModerationService implements OnModuleInit {
  private readonly logger = new Logger(ContentModerationService.name);

  // Patrones sospechosos: suman puntaje pero por sí solos no rechazan
  private readonly patterns = [
    {
      pattern: /gana(?:s|r|)\s+(?:hasta\s+)?\$?\s?\d+/gi,
      severity: ModerationSeverity.MEDIUM,
      reason: "Promesa de ganancias específicas",
    },
    {
      pattern: /inversion\s+de\s+\$?\s?\d+/gi,
      severity: ModerationSeverity.HIGH,
      reason: "Solicitud de inversión inicial",
    },
    {
      pattern: /deposit(?:a|ar|e|es)\s+\$?\s?\d+/gi,
      severity: ModerationSeverity.HIGH,
      reason: "Solicitud de depósito",
    },
    {
      pattern: /whatsapp\s*:?\s*\+?\d{6,}/gi,
      severity: ModerationSeverity.LOW,
      reason: "Contacto directo por WhatsApp en el texto",
    },
    {
      pattern: /(urgente|inmediato).*contrata/gi,
      severity: ModerationSeverity.LOW,
      reason: "Urgencia excesiva",
    },
    {
      pattern: /\b(https?:\/\/|www\.)[^\s]+/gi,
      severity: ModerationSeverity.LOW,
      reason: "Enlaces externos detectados",
    },
    {
      pattern: /email\s*:\s*[^\s@]+@[^\s@]+/gi,
      severity: ModerationSeverity.LOW,
      reason: "Email directo en descripción",
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshTerms();
  }

  /** Recarga los términos desde la base. Si falla, se mantienen los anteriores. */
  async refreshTerms(): Promise<void> {
    if (termsLoading) return termsLoading;
    termsLoading = (async () => {
      try {
        const rows = await this.prisma.moderationTerm.findMany({
          where: { active: true },
          select: { term: true, category: true },
        });
        termsCache = {
          terms: rows.map((r) => compileTerm(r.term, r.category)),
          loadedAt: Date.now(),
        };
      } catch (error: any) {
        this.logger.warn(`No se pudieron cargar los términos de moderación: ${error?.message}`);
        if (termsCache) {
          termsCache.loadedAt = Date.now();
        }
      } finally {
        termsLoading = null;
      }
    })();
    return termsLoading;
  }

  private getTerms(): CompiledTerm[] {
    if (!termsCache || Date.now() - termsCache.loadedAt > TERMS_TTL_MS) {
      void this.refreshTerms();
    }
    return termsCache?.terms ?? FALLBACK_TERMS.map((t) => compileTerm(t.term, t.category));
  }

  /**
   * Analiza el contenido completo de un empleo.
   * Cualquier término prohibido rechaza el aviso; los patrones y el spam solo
   * rechazan si juntos suman 50 puntos o más.
   */
  analyzeJobContent(jobData: {
    title: string;
    description: string;
    requirements: string;
    salary?: string;
    companyName?: string;
  }): ModerationResult {
    const rawContent = [
      jobData.title,
      jobData.description,
      jobData.requirements,
      jobData.salary || "",
      jobData.companyName || "",
    ].join(" ");
    const content = normalizeText(rawContent);

    let score = 0;
    const reasons: string[] = [];
    const flaggedWords: string[] = [];
    const suggestions: string[] = [];
    let highestSeverity = ModerationSeverity.LOW;

    // 1. Términos prohibidos (administrados desde el backoffice)
    const found = new Map<ModerationTermCategory, string[]>();
    for (const t of this.getTerms()) {
      if (t.regex.test(content)) {
        found.set(t.category, [...(found.get(t.category) || []), t.term]);
      }
    }
    for (const category of CATEGORY_ORDER) {
      const words = found.get(category);
      if (!words?.length) continue;
      const rule = CATEGORY_RULES[category];
      score += rule.score;
      flaggedWords.push(...words);
      reasons.push(`${rule.reason} (${this.quoteWords(words)})`);
      if (rule.suggestion) suggestions.push(rule.suggestion);
      if (this.compareSeverity(rule.severity, highestSeverity) > 0) {
        highestSeverity = rule.severity;
      }
    }
    const hasProhibitedTerms = flaggedWords.length > 0;

    // 2. Patrones sospechosos
    for (const patternObj of this.patterns) {
      const matches = content.match(patternObj.pattern);
      if (matches) {
        score += this.getSeverityScore(patternObj.severity);
        flaggedWords.push(...matches);
        reasons.push(patternObj.reason);
        if (this.compareSeverity(patternObj.severity, highestSeverity) > 0) {
          highestSeverity = patternObj.severity;
        }
      }
    }

    // 3. Spam
    const spamCheck = this.checkSpam(content, rawContent);
    if (spamCheck.isSpam) {
      score += 25;
      reasons.push(spamCheck.reason);
      suggestions.push("Evita repetir palabras o usar mayúsculas excesivas");
    }

    // 4. Calidad: solo sugerencias, no penaliza
    suggestions.push(...this.performQualityChecks(jobData));

    score = Math.min(score, 100);
    const isApproved = !hasProhibitedTerms && score < 50;

    return {
      isApproved,
      needsManualReview: isApproved && score >= 30,
      severity: highestSeverity,
      reasons,
      flaggedWords: [...new Set(flaggedWords)],
      score,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  // ---------- Administración de términos ----------

  async listTerms() {
    return this.prisma.moderationTerm.findMany({
      orderBy: [{ category: "asc" }, { term: "asc" }],
    });
  }

  async createTerm(dto: { term?: string; category?: string; active?: boolean }) {
    const term = this.validateTerm(dto.term);
    const category = this.validateCategory(dto.category);
    try {
      const created = await this.prisma.moderationTerm.create({
        data: { term, category, active: dto.active ?? true },
      });
      await this.forceRefresh();
      return created;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ConflictException(`El término "${term}" ya existe`);
      }
      throw error;
    }
  }

  async updateTerm(
    id: string,
    dto: { term?: string; category?: string; active?: boolean },
  ) {
    const data: { term?: string; category?: ModerationTermCategory; active?: boolean } = {};
    if (dto.term !== undefined) data.term = this.validateTerm(dto.term);
    if (dto.category !== undefined) data.category = this.validateCategory(dto.category);
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    try {
      const updated = await this.prisma.moderationTerm.update({ where: { id }, data });
      await this.forceRefresh();
      return updated;
    } catch (error: any) {
      if (error?.code === "P2025") throw new NotFoundException("Término no encontrado");
      if (error?.code === "P2002") {
        throw new ConflictException(`El término "${data.term}" ya existe`);
      }
      throw error;
    }
  }

  async deleteTerm(id: string) {
    try {
      await this.prisma.moderationTerm.delete({ where: { id } });
      await this.forceRefresh();
    } catch (error: any) {
      if (error?.code === "P2025") throw new NotFoundException("Término no encontrado");
      throw error;
    }
  }

  private async forceRefresh() {
    if (termsLoading) await termsLoading;
    await this.refreshTerms();
  }

  private validateTerm(value: unknown): string {
    const term = typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
    if (term.length < 2 || term.length > 100) {
      throw new BadRequestException("El término debe tener entre 2 y 100 caracteres");
    }
    return term;
  }

  private validateCategory(value: unknown): ModerationTermCategory {
    if (typeof value !== "string" || !CATEGORY_ORDER.includes(value as ModerationTermCategory)) {
      throw new BadRequestException(
        `Categoría inválida. Valores posibles: ${CATEGORY_ORDER.join(", ")}`,
      );
    }
    return value as ModerationTermCategory;
  }

  // ---------- Helpers ----------

  private quoteWords(words: string[]): string {
    return words.map((w) => `"${w}"`).join(", ");
  }

  private performQualityChecks(jobData: {
    title: string;
    description: string;
    requirements: string;
  }): string[] {
    const suggestions: string[] = [];
    if (jobData.description.trim().length < 50) {
      suggestions.push("La descripción debería tener al menos 50 caracteres");
    }
    if (jobData.description.trim().length > 5000) {
      suggestions.push("Intenta ser más conciso en la descripción");
    }
    if (jobData.requirements.trim().length < 20) {
      suggestions.push("Especifica claramente los requisitos del puesto");
    }
    if (jobData.title.trim().length > 100) {
      suggestions.push("Usa un título más conciso");
    }
    return suggestions;
  }

  private checkSpam(content: string, rawContent: string): { isSpam: boolean; reason: string } {
    const wordCounts: { [key: string]: number } = {};
    for (const word of content.split(/\s+/)) {
      if (word.length > 4) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
    const repeatedWords = Object.values(wordCounts).filter((count) => count > 5);
    if (repeatedWords.length > 2) {
      return { isSpam: true, reason: "Contenido repetitivo detectado (posible spam)" };
    }

    const letters = rawContent.match(/\p{L}/gu) || [];
    const uppercase = rawContent.match(/\p{Lu}/gu) || [];
    if (letters.length > 50 && uppercase.length / letters.length > 0.5) {
      return { isSpam: true, reason: "Uso excesivo de mayúsculas" };
    }

    if (/([^\s\d])\1{4,}/u.test(content)) {
      return { isSpam: true, reason: "Caracteres especiales repetidos" };
    }

    return { isSpam: false, reason: "" };
  }

  private getSeverityScore(severity: ModerationSeverity): number {
    switch (severity) {
      case ModerationSeverity.LOW:
        return 10;
      case ModerationSeverity.MEDIUM:
        return 20;
      case ModerationSeverity.HIGH:
        return 30;
      case ModerationSeverity.CRITICAL:
        return 40;
      default:
        return 0;
    }
  }

  private compareSeverity(a: ModerationSeverity, b: ModerationSeverity): number {
    const order = [
      ModerationSeverity.LOW,
      ModerationSeverity.MEDIUM,
      ModerationSeverity.HIGH,
      ModerationSeverity.CRITICAL,
    ];
    return order.indexOf(a) - order.indexOf(b);
  }
}
