import { Injectable, Logger } from "@nestjs/common";
import { ExtractedCVData } from "../cv/types/extracted-cv-data.type";
import OpenAI from "openai";

@Injectable()
export class CVParserService {
  private readonly logger = new Logger(CVParserService.name);
  private openai: OpenAI | null = null;

  constructor() {
    // Inicializar cliente de OpenAI si hay API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log("Cliente de OpenAI inicializado correctamente");
    } else {
      this.logger.warn(
        "OPENAI_API_KEY no configurada. El parsing de CVs usará fallback basado en regex."
      );
    }
  }

  /**
   * Extraer datos del texto del CV usando IA
   */
  async parseCVText(text: string): Promise<ExtractedCVData> {
    // Si no hay OpenAI configurado, usar fallback
    if (!this.openai) {
      this.logger.warn("Usando parsing basado en regex (fallback)");
      return this.parseCVTextFallback(text);
    }

    try {
      // Limitar el texto a un tamaño razonable para la IA (máximo ~8000 tokens)
      const maxTextLength = 30000; // Aproximadamente 8000 tokens
      const truncatedText =
        text.length > maxTextLength
          ? text.substring(0, maxTextLength) + "..."
          : text;

      const prompt = `Eres un parser de CVs especializado. Quiero que leas el siguiente CV en texto plano y devuelvas SOLO un JSON válido que respete EXACTAMENTE esta estructura (sin texto adicional, sin markdown, solo JSON):

{
  "fullName": string | null,
  "phone": string | null,
  "email": string | null,
  "address": string | null,
  "city": string | null,
  "province": string | null,
  "country": string | null,
  "postalCode": string | null,
  "linkedInUrl": string | null,
  "githubUrl": string | null,
  "portfolioUrl": string | null,
  "websiteUrl": string | null,
  "resumeTitle": string | null,
  "professionalDescription": string | null,
  "skills": string[],
  "education": [
    {
      "degree": string | null,
      "institution": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "isCurrent": boolean | null,
      "country": string | null,
      "studyArea": string | null,
      "studyType": string | null,
      "status": string | null,
      "description": string | null,
      "gpa": number | null,
      "honors": string | null
    }
  ],
  "experiences": [
    {
      "position": string | null,
      "company": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "isCurrent": boolean | null,
      "description": string | null,
      "companyCountry": string | null,
      "jobArea": string | null,
      "companyActivity": string | null,
      "experienceLevel": "JUNIOR" | "SEMISENIOR" | "SENIOR" | null
    }
  ]
}

Reglas importantes:
- Devuelve SIEMPRE un JSON sintácticamente válido.
- Si un dato no está en el CV, usa null o un arreglo vacío según corresponda.
- Normaliza fechas a formato "YYYY-MM-DD" cuando puedas inferirlas (aunque solo tengas el año, usa "YYYY-01-01" para inicio y "YYYY-12-31" para fin).
- Para isCurrent: true si la experiencia/educación está en curso (presente, actual, etc.), false o null si terminó.
- Extrae experiencias laborales con puesto, empresa y fechas aproximadas si están disponibles.
- Extrae educación (título, institución, fechas).
- Extrae skills técnicas y blandas como una lista de strings únicos.
- Si no encuentras información para un campo, usa null (no uses strings vacíos).
- Para experienceLevel, infiere de palabras clave: "senior", "sénior", "sr" → SENIOR; "semi", "semi-senior", "middle", "intermedio" → SEMISENIOR; "junior", "jr", "trainee", "intern" → JUNIOR.

Texto del CV:
"""${truncatedText}"""`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un asistente especializado en extraer información estructurada de CVs. Siempre devuelves JSON válido sin texto adicional.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Baja temperatura para respuestas más consistentes
        max_tokens: 2000,
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error("No se recibió respuesta de OpenAI");
      }

      // Parsear JSON
      const parsed = JSON.parse(rawContent) as ExtractedCVData;

      // Validar y limpiar datos
      return this.validateAndCleanExtractedData(parsed);
    } catch (error: any) {
      // Manejar errores específicos de OpenAI
      if (error?.status === 429) {
        this.logger.warn(
          "Cuota de OpenAI excedida. Usando parsing basado en regex (fallback)"
        );
      } else if (error?.status === 401) {
        this.logger.warn(
          "API key de OpenAI inválida. Usando parsing basado en regex (fallback)"
        );
      } else {
        this.logger.error(
          `Error al parsear CV con IA: ${error?.message || error}`,
          error?.stack
        );
        this.logger.warn("Usando parsing basado en regex (fallback)");
      }
      // Fallback a parsing basado en regex
      return this.parseCVTextFallback(text);
    }
  }

  /**
   * Parsear PDF desde buffer
   */
  async parsePdfCv(buffer: Buffer): Promise<ExtractedCVData> {
    // Esta función será llamada desde upload.service.ts después de extraer el texto del PDF
    // Por ahora, solo parseamos texto. El PDF parsing se hace en upload.service.ts
    throw new Error(
      "parsePdfCv debe ser llamado con texto extraído del PDF, no con buffer"
    );
  }

  /**
   * Validar y limpiar datos extraídos
   */
  private validateAndCleanExtractedData(data: any): ExtractedCVData {
    const cleaned: ExtractedCVData = {
      fullName: data.fullName || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      province: data.province || null,
      country: data.country || null,
      postalCode: data.postalCode || null,
      linkedInUrl: data.linkedInUrl || null,
      githubUrl: data.githubUrl || null,
      portfolioUrl: data.portfolioUrl || null,
      websiteUrl: data.websiteUrl || null,
      resumeTitle: data.resumeTitle || null,
      professionalDescription: data.professionalDescription || null,
      skills: Array.isArray(data.skills)
        ? [
            ...new Set(
              data.skills.filter(
                (s: any) => s && typeof s === "string"
              ) as string[]
            ),
          ]
        : [],
      education: Array.isArray(data.education)
        ? data.education
            .filter((edu: any) => edu && (edu.degree || edu.institution))
            .map((edu: any) => ({
              degree: edu.degree || null,
              institution: edu.institution || null,
              startDate: edu.startDate || null,
              endDate: edu.endDate || null,
              isCurrent:
                edu.isCurrent === true
                  ? true
                  : edu.isCurrent === false
                  ? false
                  : null,
              country: edu.country || null,
              studyArea: edu.studyArea || null,
              studyType: edu.studyType || null,
              status: edu.status || null,
              description: edu.description || null,
              gpa: typeof edu.gpa === "number" ? edu.gpa : null,
              honors: edu.honors || null,
            }))
        : [],
      experiences: Array.isArray(data.experiences)
        ? data.experiences
            .filter((exp: any) => exp && (exp.position || exp.company))
            .map((exp: any) => ({
              position: exp.position || null,
              company: exp.company || null,
              startDate: exp.startDate || null,
              endDate: exp.endDate || null,
              isCurrent:
                exp.isCurrent === true
                  ? true
                  : exp.isCurrent === false
                  ? false
                  : null,
              description: exp.description || null,
              companyCountry: exp.companyCountry || null,
              jobArea: exp.jobArea || null,
              companyActivity: exp.companyActivity || null,
              experienceLevel:
                exp.experienceLevel === "JUNIOR" ||
                exp.experienceLevel === "SEMISENIOR" ||
                exp.experienceLevel === "SENIOR"
                  ? exp.experienceLevel
                  : null,
            }))
        : [],
    };

    return cleaned;
  }

  /**
   * Fallback: parsing basado en regex (método anterior simplificado)
   */
  private parseCVTextFallback(text: string): ExtractedCVData {
    const data: ExtractedCVData = {};

    // Normalizar el texto
    const normalizedText = text.replace(/\s+/g, " ").trim();

    // Extraer email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatch = normalizedText.match(emailRegex);
    data.email = emailMatch?.[0] || null;

    // Extraer teléfono
    const phonePatterns = [
      /(\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
      /(\+54[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/g,
      /\b\d{10,11}\b/g,
    ];
    for (const pattern of phonePatterns) {
      const matches = normalizedText.match(pattern);
      if (matches && matches.length > 0) {
        data.phone = matches[0].trim();
        break;
      }
    }
    if (!data.phone) data.phone = null;

    // Extraer URLs
    const linkedInRegex =
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|profile)\/[\w-]+/gi;
    const linkedInMatch = normalizedText.match(linkedInRegex);
    data.linkedInUrl = linkedInMatch?.[0] || null;

    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/gi;
    const githubMatch = normalizedText.match(githubRegex);
    data.githubUrl = githubMatch?.[0] || null;

    // Skills básicos (búsqueda de tecnologías comunes)
    const commonSkills = [
      "JavaScript",
      "TypeScript",
      "React",
      "Angular",
      "Vue",
      "Node.js",
      "Python",
      "Java",
      "C#",
      "PHP",
      "SQL",
      "MongoDB",
      "PostgreSQL",
      "AWS",
      "Docker",
      "Git",
      "HTML",
      "CSS",
    ];
    const foundSkills: string[] = [];
    for (const skill of commonSkills) {
      if (
        normalizedText.toLowerCase().includes(skill.toLowerCase()) &&
        !foundSkills.some((s) => s.toLowerCase() === skill.toLowerCase())
      ) {
        foundSkills.push(skill);
      }
    }
    data.skills = foundSkills;

    // Retornar datos básicos (sin educación/experiencias en fallback)
    return {
      ...data,
      fullName: null,
      address: null,
      city: null,
      province: null,
      country: null,
      postalCode: null,
      portfolioUrl: null,
      websiteUrl: null,
      resumeTitle: null,
      professionalDescription: null,
      education: [],
      experiences: [],
    };
  }
}
