import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TermsType, UserType } from "@prisma/client";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { GCSUploadService } from "../upload/gcs-upload.service";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class TermsService {
  constructor(
    private prisma: PrismaService,
    private gcsUploadService: GCSUploadService,
    private gcpCdnService: GcpCdnService
  ) {}

  /**
   * Obtiene los términos activos según el tipo de usuario o tipo específico
   */
  async getActiveTerms(userType?: UserType, termsType?: TermsType) {
    let type: TermsType;

    if (termsType) {
      type = termsType;
    } else if (userType) {
      // Mapear UserType a TermsType
      if (userType === "POSTULANTE") {
        type = TermsType.POSTULANTE;
      } else if (userType === "EMPRESA") {
        type = TermsType.EMPRESA;
      } else {
        throw new BadRequestException(
          "Tipo de usuario no válido para términos"
        );
      }
    } else {
      throw new BadRequestException("Debe especificar el tipo de términos");
    }

    const terms = await this.prisma.termsAndConditions.findFirst({
      where: {
        type,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!terms) {
      throw new NotFoundException(
        `No se encontraron términos activos para el tipo ${type}`
      );
    }

    return terms;
  }

  /**
   * Verifica si el usuario ha aceptado la versión actual de los términos
   */
  async hasAcceptedTerms(userId: string, type: TermsType): Promise<boolean> {
    const activeTerms = await this.getActiveTerms(undefined, type);

    const acceptance = await this.prisma.userTermsAcceptance.findUnique({
      where: {
        userId_termsId: {
          userId,
          termsId: activeTerms.id,
        },
      },
    });

    return !!acceptance;
  }

  /**
   * Acepta los términos y condiciones
   */
  async acceptTerms(userId: string, type: TermsType, version: string) {
    // Verificar que existe la versión especificada
    const terms = await this.prisma.termsAndConditions.findUnique({
      where: {
        type_version: {
          type,
          version,
        },
      },
    });

    if (!terms) {
      throw new NotFoundException(
        `No se encontraron términos de tipo ${type} versión ${version}`
      );
    }

    // Verificar si ya fueron aceptados
    const existing = await this.prisma.userTermsAcceptance.findUnique({
      where: {
        userId_termsId: {
          userId,
          termsId: terms.id,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Crear aceptación
    return await this.prisma.userTermsAcceptance.create({
      data: {
        userId,
        termsId: terms.id,
      },
      include: {
        terms: true,
      },
    });
  }

  /**
   * Extrae texto de un PDF y lo convierte a markdown
   */
  private async extractTextFromPdfToMarkdown(buffer: Buffer): Promise<string> {
    try {
      // Importar pdfjs-dist dinámicamente
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      
      // Cargar el documento PDF desde el buffer
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        verbosity: 0, // Reducir logs
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      let markdownContent = "";
      
      // Extraer texto de cada página
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extraer texto preservando saltos de línea naturales
        let pageText = "";
        const items = textContent.items as any[];
        
        if (items.length === 0) {
          continue;
        }
        
        // Agrupar items por línea (misma posición Y aproximadamente)
        const lines: { y: number; text: string; items: any[] }[] = [];
        
        for (const item of items) {
          const text = item.str || "";
          if (!text.trim()) continue;
          
          const transform = item.transform || [];
          const currentY = transform.length > 5 ? Math.round(transform[5]) : null;
          
          if (currentY === null) {
            // Si no hay Y, agregar al final
            if (lines.length > 0) {
              lines[lines.length - 1].text += " " + text;
            } else {
              lines.push({ y: 0, text: text, items: [item] });
            }
            continue;
          }
          
          // Buscar línea existente con Y similar (tolerancia de 5 píxeles)
          let foundLine = false;
          for (const line of lines) {
            if (Math.abs(line.y - currentY) <= 5) {
              // Misma línea, agregar texto
              line.text += " " + text;
              line.items.push(item);
              foundLine = true;
              break;
            }
          }
          
          if (!foundLine) {
            // Nueva línea
            lines.push({ y: currentY, text: text, items: [item] });
          }
        }
        
        // Ordenar líneas por Y (de arriba a abajo)
        lines.sort((a, b) => b.y - a.y);
        
        // Construir texto de la página
        let previousY: number | null = null;
        for (const line of lines) {
          const trimmedText = line.text.trim();
          if (!trimmedText) continue;
          
          // Detectar si hay un salto de párrafo grande (espacio vertical significativo)
          if (previousY !== null) {
            const yDiff = previousY - line.y; // Diferencia positiva porque ordenamos descendente
            // Si hay más de 20 píxeles de diferencia, es probablemente un párrafo nuevo
            if (yDiff > 20) {
              if (pageText && !pageText.endsWith("\n\n")) {
                pageText += "\n\n";
              }
            } else if (pageText && !pageText.endsWith("\n")) {
              pageText += "\n";
            }
          }
          
          // Manejar palabras divididas (terminan con guión)
          if (pageText.endsWith("-")) {
            pageText = pageText.slice(0, -1) + trimmedText;
          } else {
            pageText += trimmedText;
          }
          
          previousY = line.y;
        }
        
        // Agregar separador entre páginas si hay contenido
        if (pageText.trim()) {
          markdownContent += pageText.trim();
          if (pageNum < numPages) {
            markdownContent += "\n\n";
          }
        }
      }
      
      // Limpiar el markdown final
      markdownContent = markdownContent
        .replace(/\n{3,}/g, "\n\n") // Máximo 2 saltos seguidos
        .replace(/\s+$/gm, "") // Eliminar espacios al final de líneas
        .replace(/[ \t]+/g, " ") // Normalizar espacios horizontales dentro de líneas
        .replace(/\n /g, "\n") // Eliminar espacios después de saltos de línea
        .replace(/ \n/g, "\n") // Eliminar espacios antes de saltos de línea
        .trim();
      
      return markdownContent;
    } catch (error: any) {
      console.error("Error al extraer texto del PDF:", error);
      throw new Error(`No se pudo extraer texto del PDF: ${error.message}`);
    }
  }

  /**
   * Sube un nuevo PDF de términos y condiciones a S3 (solo admin)
   */
  async uploadTerms(
    file: MulterFile,
    type: TermsType,
    version: string,
    description?: string
  ) {
    // Validar que es un PDF
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("El archivo debe ser un PDF");
    }

    // Verificar si ya existe esta versión
    const existing = await this.prisma.termsAndConditions.findUnique({
      where: {
        type_version: {
          type,
          version,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una versión ${version} para el tipo ${type}`
      );
    }

    // Desactivar versiones anteriores del mismo tipo
    await this.prisma.termsAndConditions.updateMany({
      where: {
        type,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Generar key para Cloud Storage
    const timestamp = Date.now();
    const key = `terms/${type.toLowerCase()}/${version}-${timestamp}.pdf`;

    // Subir archivo a Cloud Storage
    await this.gcsUploadService.uploadBuffer(
      key,
      file.buffer,
      file.mimetype
    );

    // Generar URL de CloudFront
    const fileUrl = await this.gcpCdnService.getCdnUrl(key);

    // Extraer texto del PDF y convertirlo a markdown
    let markdownContent: string | null = null;
    try {
      markdownContent = await this.extractTextFromPdfToMarkdown(file.buffer);
      console.log(`✅ Texto extraído del PDF de términos (${type} v${version}): ${markdownContent.length} caracteres`);
    } catch (error: any) {
      // Log del error pero no fallar el upload
      console.error("⚠️ Error al extraer texto del PDF de términos:", error);
      // Continuar sin el markdown
    }

    // Crear registro en la base de datos
    const terms = await this.prisma.termsAndConditions.create({
      data: {
        type,
        version,
        fileUrl,
        markdownContent,
        isActive: true,
        description,
      },
    });

    return terms;
  }

  /**
   * Obtiene todas las versiones de términos (para admin)
   */
  async getAllTerms(type?: TermsType) {
    return await this.prisma.termsAndConditions.findMany({
      where: type ? { type } : undefined,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            acceptances: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene el historial de aceptaciones de un usuario
   */
  async getUserAcceptances(userId: string) {
    return await this.prisma.userTermsAcceptance.findMany({
      where: {
        userId,
      },
      include: {
        terms: true,
      },
      orderBy: {
        acceptedAt: "desc",
      },
    });
  }
}
