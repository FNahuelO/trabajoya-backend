import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async listJobFavorites(userId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.jobFavorite.findMany({
      where: { postulanteId: postulante.id },
      include: { job: { include: { empresa: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listCompanyFavorites(userId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.companyFavorite.findMany({
      where: { postulanteId: postulante.id },
      include: { empresa: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async addJobFavorite(userId: string, jobId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.jobFavorite.upsert({
      where: { postulanteId_jobId: { postulanteId: postulante.id, jobId } },
      update: {},
      create: { postulanteId: postulante.id, jobId },
    });
  }

  async removeJobFavorite(userId: string, jobId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.jobFavorite.delete({
      where: { postulanteId_jobId: { postulanteId: postulante.id, jobId } },
    });
  }

  async addCompanyFavorite(userId: string, empresaId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.companyFavorite.upsert({
      where: {
        postulanteId_empresaId: { postulanteId: postulante.id, empresaId },
      },
      update: {},
      create: { postulanteId: postulante.id, empresaId },
    });
  }

  async removeCompanyFavorite(userId: string, empresaId: string) {
    const postulante = await this.findPostulanteId(userId);
    return this.prisma.companyFavorite.delete({
      where: {
        postulanteId_empresaId: { postulanteId: postulante.id, empresaId },
      },
    });
  }

  private async findPostulanteId(userId: string) {
    const postulante = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });
    if (!postulante)
      throw new NotFoundException("Perfil de postulante no encontrado");
    return postulante;
  }
}
