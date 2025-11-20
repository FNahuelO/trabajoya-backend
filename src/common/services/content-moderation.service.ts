import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentModerationService {
  // Lista de palabras no deseadas (puedes expandir esta lista)
  private readonly forbiddenWords = [
    // Palabras relacionadas con estafas
    'dinero fácil',
    'gana dinero rápido',
    'trabajo desde casa sin experiencia',
    'inversión inicial',
    'multinivel',
    'piramidal',
    'esquema piramidal',
    'ganancias garantizadas',
    // Palabras relacionadas con trabajo forzado/exploitación
    'sin pago',
    'trabajo gratis',
    'solo experiencia',
    'sin sueldo',
    'trabajo voluntario obligatorio',
    // Palabras ofensivas o discriminatorias
    'solo hombres',
    'solo mujeres',
    'edad máxima',
    'solo jóvenes',
    'no mayores de',
    // Otras palabras sospechosas
    'envía dinero',
    'deposita',
    'transferencia',
    'crypto',
    'bitcoin',
    'criptomoneda',
  ];

  // Patrones sospechosos
  private readonly suspiciousPatterns = [
    /\$\d+/g, // Menciones de dinero con símbolo $
    /gana\s+\$\d+/gi,
    /inversión\s+de\s+\$\d+/gi,
    /deposita\s+\$\d+/gi,
    /envía\s+\$\d+/gi,
    /\d+\s*%\s*de\s+comisión/gi,
    /sin\s+experiencia\s+necesaria/gi,
    /trabajo\s+desde\s+casa\s+sin\s+experiencia/gi,
  ];

  /**
   * Analiza el contenido de un empleo y determina si debe ser rechazado automáticamente
   * @param jobData Datos del empleo a analizar
   * @returns Objeto con el resultado del análisis
   */
  analyzeJobContent(jobData: {
    title: string;
    description: string;
    requirements: string;
  }): {
    isApproved: boolean;
    reason?: string;
    flaggedWords?: string[];
  } {
    const content = `${jobData.title} ${jobData.description} ${jobData.requirements}`.toLowerCase();
    const flaggedWords: string[] = [];

    // Verificar palabras prohibidas
    for (const word of this.forbiddenWords) {
      if (content.includes(word.toLowerCase())) {
        flaggedWords.push(word);
      }
    }

    // Verificar patrones sospechosos
    const suspiciousMatches: string[] = [];
    for (const pattern of this.suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        suspiciousMatches.push(...matches);
      }
    }

    // Si hay palabras prohibidas o patrones sospechosos, rechazar
    if (flaggedWords.length > 0 || suspiciousMatches.length > 0) {
      const reasons: string[] = [];
      
      if (flaggedWords.length > 0) {
        reasons.push(`Palabras no permitidas detectadas: ${flaggedWords.slice(0, 3).join(', ')}`);
      }
      
      if (suspiciousMatches.length > 0) {
        reasons.push(`Patrones sospechosos detectados`);
      }

      return {
        isApproved: false,
        reason: reasons.join('. '),
        flaggedWords: [...flaggedWords, ...suspiciousMatches],
      };
    }

    // Verificaciones adicionales
    // 1. Verificar que la descripción tenga contenido sustancial
    if (jobData.description.trim().length < 50) {
      return {
        isApproved: false,
        reason: 'La descripción del empleo es demasiado corta o insuficiente',
      };
    }

    // 2. Verificar que los requisitos tengan contenido
    if (jobData.requirements.trim().length < 20) {
      return {
        isApproved: false,
        reason: 'Los requisitos del empleo son insuficientes',
      };
    }

    // Si pasa todas las verificaciones, aprobar para revisión manual
    return {
      isApproved: true,
    };
  }

  /**
   * Obtiene una lista de palabras prohibidas (para uso en frontend si es necesario)
   */
  getForbiddenWords(): string[] {
    return [...this.forbiddenWords];
  }
}


