import { Injectable } from "@nestjs/common";

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

@Injectable()
export class ContentModerationService {
  // Palabras prohibidas por categoría
  private readonly scamWords = [
    "dinero fácil",
    "gana dinero rápido",
    "trabajo desde casa sin experiencia",
    "inversión inicial",
    "multinivel",
    "piramidal",
    "esquema piramidal",
    "ganancias garantizadas",
    "marketing multinivel",
    "mlm",
    "ganar dinero sin trabajar",
    "negocio propio sin inversión",
    "ingresos pasivos fáciles",
    "hazte rico",
  ];

  private readonly exploitationWords = [
    "sin pago",
    "trabajo gratis",
    "solo experiencia",
    "sin sueldo",
    "trabajo voluntario obligatorio",
    "trabajo sin remuneración",
    "solo comisión",
    "pago en especie",
    "sin contrato",
    "trabajo informal",
  ];

  private readonly discriminationWords = [
    "solo hombres",
    "solo mujeres",
    "edad máxima",
    "solo jóvenes",
    "no mayores de",
    "preferentemente hombres",
    "preferentemente mujeres",
    "buena presencia",
    "físico agradable",
    "estado civil",
    "sin hijos",
    "soltera",
    "soltero",
  ];

  private readonly offensiveWords = [
    "idiota",
    "imbécil",
    "estúpido",
    "tonto",
    "retrasado",
    "inútil",
    "pendejo",
    "hijo de",
    "mierda",
    "carajo",
  ];

  private readonly inappropriateOffers = [
    "envía dinero",
    "deposita",
    "crypto",
    "bitcoin",
    "criptomoneda",
    "modelo webcam",
    "trabajo sexual",
    "acompañante",
    "masajista sensual",
    "servicios para adultos",
    "entretenimiento adulto",
    "contenido adulto",
  ];

  // Patrones sospechosos con severidad
  private readonly patterns = [
    {
      pattern: /\$\d{3,}/g,
      severity: ModerationSeverity.MEDIUM,
      reason: "Mención de grandes cantidades de dinero",
    },
    {
      pattern: /gana\s+\$?\d+/gi,
      severity: ModerationSeverity.MEDIUM,
      reason: "Promesa de ganancias específicas",
    },
    {
      pattern: /inversión\s+de\s+\$?\d+/gi,
      severity: ModerationSeverity.HIGH,
      reason: "Solicitud de inversión inicial",
    },
    {
      pattern: /deposita\s+\$?\d+/gi,
      severity: ModerationSeverity.HIGH,
      reason: "Solicitud de depósito",
    },
    {
      pattern: /\d+\s*%\s*de\s+comisión/gi,
      severity: ModerationSeverity.MEDIUM,
      reason: "Solo trabajo por comisión",
    },
    {
      pattern: /sin\s+experiencia\s+necesaria/gi,
      severity: ModerationSeverity.LOW,
      reason: "Frase común en estafas",
    },
    {
      pattern: /whatsapp\s*:?\s*\d+/gi,
      severity: ModerationSeverity.MEDIUM,
      reason: "Contacto directo por WhatsApp (posible fraude)",
    },
    {
      pattern: /(urgente|inmediato).*contrata/gi,
      severity: ModerationSeverity.LOW,
      reason: "Urgencia excesiva",
    },
    {
      pattern: /\b(https?:\/\/|www\.)[^\s]+/gi,
      severity: ModerationSeverity.MEDIUM,
      reason: "Enlaces externos detectados",
    },
    {
      pattern: /email\s*:\s*[^\s@]+@[^\s@]+/gi,
      severity: ModerationSeverity.LOW,
      reason: "Email directo en descripción",
    },
  ];

  /**
   * Analiza el contenido completo de un empleo
   */
  analyzeJobContent(jobData: {
    title: string;
    description: string;
    requirements: string;
    salary?: string;
    companyName?: string;
  }): ModerationResult {
    const content = `${jobData.title} ${jobData.description} ${
      jobData.requirements
    } ${jobData.salary || ""} ${jobData.companyName || ""}`.toLowerCase();

    let score = 0;
    const reasons: string[] = [];
    const flaggedWords: string[] = [];
    const suggestions: string[] = [];
    let highestSeverity = ModerationSeverity.LOW;

    // 1. Verificar palabras prohibidas por categoría
    const scamFound = this.checkWords(content, this.scamWords);
    if (scamFound.length > 0) {
      score += 40;
      flaggedWords.push(...scamFound);
      reasons.push("Posible contenido de estafa o fraude detectado");
      highestSeverity = ModerationSeverity.CRITICAL;
    }

    const exploitationFound = this.checkWords(content, this.exploitationWords);
    if (exploitationFound.length > 0) {
      score += 35;
      flaggedWords.push(...exploitationFound);
      reasons.push("Posible explotación laboral detectada");
      highestSeverity = ModerationSeverity.HIGH;
    }

    const discriminationFound = this.checkWords(
      content,
      this.discriminationWords
    );
    if (discriminationFound.length > 0) {
      score += 30;
      flaggedWords.push(...discriminationFound);
      reasons.push("Contenido discriminatorio detectado");
      highestSeverity = ModerationSeverity.HIGH;
      suggestions.push(
        "Evita mencionar género, edad, estado civil o apariencia física"
      );
    }

    const offensiveFound = this.checkWords(content, this.offensiveWords);
    if (offensiveFound.length > 0) {
      score += 45;
      flaggedWords.push(...offensiveFound);
      reasons.push("Lenguaje ofensivo o inapropiado detectado");
      highestSeverity = ModerationSeverity.CRITICAL;
    }

    const inappropriateFound = this.checkWords(
      content,
      this.inappropriateOffers
    );
    if (inappropriateFound.length > 0) {
      score += 50;
      flaggedWords.push(...inappropriateFound);
      reasons.push("Oferta laboral inapropiada o ilegal detectada");
      highestSeverity = ModerationSeverity.CRITICAL;
    }

    // 2. Verificar patrones sospechosos
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

    // 3. Validaciones de calidad del contenido
    const qualityChecks = this.performQualityChecks(jobData);
    score += qualityChecks.score;
    reasons.push(...qualityChecks.reasons);
    suggestions.push(...qualityChecks.suggestions);

    // 4. Análisis de spam
    const spamCheck = this.checkSpam(content);
    if (spamCheck.isSpam) {
      score += 25;
      reasons.push(spamCheck.reason);
      suggestions.push("Evita repetir palabras o usar mayúsculas excesivas");
    }

    // 5. Determinar resultado final
    score = Math.min(score, 100);

    const isApproved = score < 30;
    const needsManualReview = score >= 30 && score < 50;

    return {
      isApproved,
      needsManualReview,
      severity: highestSeverity,
      reasons,
      flaggedWords: [...new Set(flaggedWords)],
      score,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Verifica palabras en una lista
   */
  private checkWords(content: string, wordList: string[]): string[] {
    const found: string[] = [];
    for (const word of wordList) {
      if (content.includes(word.toLowerCase())) {
        found.push(word);
      }
    }
    return found;
  }

  /**
   * Realiza verificaciones de calidad del contenido
   */
  private performQualityChecks(jobData: {
    title: string;
    description: string;
    requirements: string;
  }): { score: number; reasons: string[]; suggestions: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const suggestions: string[] = [];

    // Verificar longitud de descripción
    if (jobData.description.trim().length < 50) {
      score += 15;
      reasons.push("Descripción demasiado corta");
      suggestions.push("La descripción debe tener al menos 50 caracteres");
    }

    if (jobData.description.trim().length > 5000) {
      score += 10;
      reasons.push("Descripción excesivamente larga");
      suggestions.push("Intenta ser más conciso en la descripción");
    }

    // Verificar requisitos
    if (jobData.requirements.trim().length < 20) {
      score += 15;
      reasons.push("Requisitos insuficientes");
      suggestions.push("Especifica claramente los requisitos del puesto");
    }

    // Verificar título
    if (jobData.title.trim().length < 5) {
      score += 20;
      reasons.push("Título demasiado corto");
      suggestions.push("El título debe describir claramente el puesto");
    }

    if (jobData.title.trim().length > 100) {
      score += 10;
      reasons.push("Título demasiado largo");
      suggestions.push("Usa un título más conciso");
    }

    return { score, reasons, suggestions };
  }

  /**
   * Verifica contenido spam
   */
  private checkSpam(content: string): { isSpam: boolean; reason: string } {
    // Verificar palabras repetitivas
    const words = content.split(/\s+/);
    const wordCounts: { [key: string]: number } = {};

    for (const word of words) {
      if (word.length > 4) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }

    const repeatedWords = Object.entries(wordCounts).filter(
      ([_, count]) => count > 5
    );
    if (repeatedWords.length > 2) {
      return {
        isSpam: true,
        reason: "Contenido repetitivo detectado (posible spam)",
      };
    }

    // Verificar mayúsculas excesivas
    const uppercaseRatio =
      (content.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length / content.length;
    if (uppercaseRatio > 0.5 && content.length > 50) {
      return {
        isSpam: true,
        reason: "Uso excesivo de mayúsculas",
      };
    }

    // Verificar caracteres especiales repetidos
    if (/(.)\1{4,}/.test(content)) {
      return {
        isSpam: true,
        reason: "Caracteres especiales repetidos",
      };
    }

    return { isSpam: false, reason: "" };
  }

  /**
   * Obtiene el score numérico según la severidad
   */
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

  /**
   * Compara severidades (-1, 0, 1)
   */
  private compareSeverity(
    a: ModerationSeverity,
    b: ModerationSeverity
  ): number {
    const order = [
      ModerationSeverity.LOW,
      ModerationSeverity.MEDIUM,
      ModerationSeverity.HIGH,
      ModerationSeverity.CRITICAL,
    ];
    return order.indexOf(a) - order.indexOf(b);
  }

  /**
   * Obtiene sugerencias para mejorar una publicación rechazada
   */
  getSuggestions(result: ModerationResult): string[] {
    const suggestions: string[] = [];

    if (result.flaggedWords.some((w) => this.scamWords.includes(w))) {
      suggestions.push(
        "Evita promesas de ganancias o menciones de esquemas de inversión"
      );
    }

    if (result.flaggedWords.some((w) => this.discriminationWords.includes(w))) {
      suggestions.push(
        "Elimina cualquier mención de género, edad, estado civil o apariencia física"
      );
    }

    if (result.flaggedWords.some((w) => this.exploitationWords.includes(w))) {
      suggestions.push(
        "Especifica claramente el salario y condiciones laborales"
      );
    }

    suggestions.push(
      "Usa lenguaje profesional y describe claramente las responsabilidades del puesto"
    );
    suggestions.push(
      "Incluye información sobre tu empresa y beneficios ofrecidos"
    );

    return suggestions;
  }
}
