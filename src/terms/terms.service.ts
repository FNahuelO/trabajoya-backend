import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TermsType, UserType } from "@prisma/client";
import { S3UploadService } from "../upload/s3-upload.service";
import { CloudFrontSignerService } from "../upload/cloudfront-signer.service";

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
    private s3UploadService: S3UploadService,
    private cloudFrontSigner: CloudFrontSignerService
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
        
        // Convertir el contenido de texto a markdown
        let pageMarkdown = "";
        let lastY: number | null = null;
        let lastFontSize = 12;
        
        for (const item of textContent.items as any[]) {
          const text = item.str || "";
          if (!text.trim()) continue;
          
          // Obtener información del item
          const transform = item.transform || [];
          const currentY = transform.length > 5 ? transform[5] : null;
          const fontSize = item.height || item.transform?.[0] || 12;
          const fontName = item.fontName || "";
          const isBold = fontName.toLowerCase().includes("bold");
          
          // Detectar títulos (texto más grande o en negrita)
          const isTitle = fontSize > 14 || (isBold && fontSize > 12);
          
          // Detectar saltos de línea o párrafos
          if (lastY !== null && currentY !== null) {
            const yDiff = Math.abs(currentY - lastY);
            // Si hay un cambio significativo en Y, es probablemente una nueva línea
            if (yDiff > 15) {
              pageMarkdown += "\n";
            }
          }
          
          // Si es un título, formatearlo como markdown
          if (isTitle && (lastY === null || (currentY !== null && Math.abs((currentY || 0) - (lastY || 0)) > 20))) {
            // Nuevo título
            if (pageMarkdown.trim() && !pageMarkdown.trim().endsWith("\n\n")) {
              pageMarkdown += "\n\n";
            }
            pageMarkdown += `## ${text}\n\n`;
          } else {
            // Texto normal
            pageMarkdown += text + " ";
          }
          
          lastY = currentY;
          lastFontSize = fontSize;
        }
        
        // Limpiar espacios múltiples y agregar separador de página
        pageMarkdown = pageMarkdown.replace(/\s+/g, " ").trim();
        if (pageMarkdown) {
          markdownContent += pageMarkdown + "\n\n";
        }
      }
      
      // Limpiar el markdown final
      markdownContent = markdownContent
        .replace(/\n{3,}/g, "\n\n") // Máximo 2 saltos de línea seguidos
        .replace(/\s+$/gm, "") // Eliminar espacios al final de líneas
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

    // Generar key para S3
    const timestamp = Date.now();
    const key = `terms/${type.toLowerCase()}/${version}-${timestamp}.pdf`;

    // Subir archivo a S3
    await this.s3UploadService.uploadBuffer(
      key,
      file.buffer,
      file.mimetype
    );

    // Generar URL de CloudFront
    const fileUrl = this.cloudFrontSigner.getCloudFrontUrl(key);

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
