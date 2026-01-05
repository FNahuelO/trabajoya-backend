import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TermsType, UserType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

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
  private readonly uploadDir = path.join(process.cwd(), "uploads");
  private readonly termsDir = path.join(this.uploadDir, "terms");

  constructor(private prisma: PrismaService) {
    // Crear directorio de términos si no existe
    if (!fs.existsSync(this.termsDir)) {
      fs.mkdirSync(this.termsDir, { recursive: true });
    }
  }

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
   * Sube un nuevo PDF de términos y condiciones (solo admin)
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

    // Guardar el archivo
    const filename = `terms-${type}-${version}-${Date.now()}.pdf`;
    const filepath = path.join(this.termsDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    const fileUrl = `/uploads/terms/${filename}`;

    // Crear registro en la base de datos
    const terms = await this.prisma.termsAndConditions.create({
      data: {
        type,
        version,
        fileUrl,
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
