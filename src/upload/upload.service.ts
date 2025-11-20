import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado
import * as fs from "fs";
import * as path from "path";

// Definir el tipo de archivo
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

  private readonly uploadDir = path.join(process.cwd(), "uploads");
  private readonly allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];
  private readonly allowedDocumentTypes = ["application/pdf"];
  private readonly allowedVideoTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
  ];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly maxVideoSize = 50 * 1024 * 1024; // 50MB

  async uploadAvatar(userId: string, file: MulterFile) {
    if (!this.allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException("Mensaje de error");
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException("Mensaje de error");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { postulante: true },
    });

    if (!user || !user.postulante) {
      throw new BadRequestException("Mensaje de error");
    }

    // Eliminar avatar anterior si existe
    if (user.postulante.profilePicture) {
      const oldPath = path.join(this.uploadDir, user.postulante.profilePicture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = `avatar-${userId}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    const filepath = path.join(this.uploadDir, "avatars", filename);

    // Crear directorio si no existe
    if (!fs.existsSync(path.join(this.uploadDir, "avatars"))) {
      fs.mkdirSync(path.join(this.uploadDir, "avatars"), { recursive: true });
    }

    fs.writeFileSync(filepath, file.buffer);

    const url = `/uploads/avatars/${filename}`;

    await this.prisma.postulanteProfile.update({
      where: { userId },
      data: { profilePicture: url },
    });

    return { url };
  }

  async uploadCompanyLogo(userId: string, file: MulterFile) {
    if (!this.allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException("Mensaje de error");
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException("Mensaje de error");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    if (!user || !user.empresa) {
      throw new BadRequestException("Mensaje de error");
    }

    // Eliminar logo anterior si existe
    if (user.empresa.logo) {
      const oldPath = path.join(this.uploadDir, user.empresa.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = `logo-${userId}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    const filepath = path.join(this.uploadDir, "logos", filename);

    // Crear directorio si no existe
    if (!fs.existsSync(path.join(this.uploadDir, "logos"))) {
      fs.mkdirSync(path.join(this.uploadDir, "logos"), { recursive: true });
    }

    fs.writeFileSync(filepath, file.buffer);

    const url = `/uploads/logos/${filename}`;

    await this.prisma.empresaProfile.update({
      where: { userId },
      data: { logo: url },
    });

    return { url };
  }

  async uploadCV(userId: string, file: MulterFile) {
    if (!this.allowedDocumentTypes.includes(file.mimetype)) {
      throw new BadRequestException("Mensaje de error");
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException("Mensaje de error");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { postulante: true },
    });

    if (!user || !user.postulante) {
      throw new BadRequestException("Mensaje de error");
    }

    // Eliminar CV anterior si existe
    if (user.postulante.cvUrl) {
      const oldPath = path.join(this.uploadDir, user.postulante.cvUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = `cv-${userId}-${Date.now()}.pdf`;
    const filepath = path.join(this.uploadDir, "cvs", filename);

    // Crear directorio si no existe
    if (!fs.existsSync(path.join(this.uploadDir, "cvs"))) {
      fs.mkdirSync(path.join(this.uploadDir, "cvs"), { recursive: true });
    }

    fs.writeFileSync(filepath, file.buffer);

    const url = `/uploads/cvs/${filename}`;

    await this.prisma.postulanteProfile.update({
      where: { userId },
      data: { cvUrl: url },
    });

    return { url };
  }

  async uploadVideo(userId: string, file: MulterFile) {
    if (!this.allowedVideoTypes.includes(file.mimetype)) {
      throw new BadRequestException("Tipo de archivo de video no permitido");
    }

    if (file.size > this.maxVideoSize) {
      throw new BadRequestException(
        "El archivo de video excede el tamaño máximo permitido (50MB)"
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { postulante: true },
    });

    if (!user || !user.postulante) {
      throw new BadRequestException("Usuario o perfil no encontrado");
    }

    // Eliminar video anterior si existe
    if (user.postulante.videoUrl) {
      const oldPath = path.join(this.uploadDir, user.postulante.videoUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = `video-${userId}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    const filepath = path.join(this.uploadDir, "videos", filename);

    // Crear directorio si no existe
    if (!fs.existsSync(path.join(this.uploadDir, "videos"))) {
      fs.mkdirSync(path.join(this.uploadDir, "videos"), { recursive: true });
    }

    fs.writeFileSync(filepath, file.buffer);

    const url = `/uploads/videos/${filename}`;

    await this.prisma.postulanteProfile.update({
      where: { userId },
      data: { videoUrl: url },
    });

    return { url };
  }
}
