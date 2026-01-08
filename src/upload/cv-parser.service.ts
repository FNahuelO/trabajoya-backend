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
      // Reducir el texto a un tamaño más pequeño para ahorrar tokens (~4000 tokens máximo)
      const maxTextLength = 15000; // Reducido de 30000 a 15000 (~4000 tokens)
      const truncatedText =
        text.length > maxTextLength
          ? text.substring(0, maxTextLength) + "..."
          : text;

      // Prompt optimizado y más corto para reducir tokens
      const prompt = `Extrae datos del CV en JSON. Estructura:
{"fullName":string|null,"phone":string|null,"email":string|null,"city":string|null,"province":string|null,"country":string|null,"postalCode":string|null,"linkedInUrl":string|null,"githubUrl":string|null,"portfolioUrl":string|null,"websiteUrl":string|null,"resumeTitle":string|null,"professionalDescription":string|null,"skills":string[],"education":[{"degree":string|null,"institution":string|null,"startDate":string|null,"endDate":string|null,"isCurrent":boolean|null,"country":string|null,"studyArea":string|null,"studyType":string|null,"status":string|null}],"experiences":[{"position":string|null,"company":string|null,"startDate":string|null,"endDate":string|null,"isCurrent":boolean|null,"description":string|null,"companyCountry":string|null,"jobArea":string|null,"companyActivity":string|null,"experienceLevel":"JUNIOR"|"SEMISENIOR"|"SENIOR"|null}]}

Reglas:
- JSON válido, sin markdown
- null si no existe, [] para arrays vacíos
- Fechas: "YYYY-MM-DD" (año solo: "YYYY-01-01"/"YYYY-12-31")
- isCurrent: true si "presente"/"actual"/"current"
- Skills: normaliza ("JS"→"JavaScript", "React.js"→"React")
- experienceLevel: "senior"/"sr"/"lead"→SENIOR, "semi"/"middle"→SEMISENIOR, "junior"/"jr"/"trainee"→JUNIOR
- URLs: completa con https:// si falta

CV:
"""${truncatedText}"""`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Extrae datos de CVs en JSON válido. Sin texto adicional.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500, // Reducido de 2000 a 1500
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
