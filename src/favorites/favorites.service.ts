import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CloudFrontSignerService } from "../upload/cloudfront-signer.service";
import { S3UploadService } from "../upload/s3-upload.service";

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private cloudFrontSigner: CloudFrontSignerService,
    private s3UploadService: S3UploadService
  ) {}

  async listJobFavorites(userId: string) {
    const postulante = await this.findPostulanteId(userId);
    const favorites = await this.prisma.jobFavorite.findMany({
      where: { postulanteId: postulante.id },
      include: { job: { include: { empresa: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Transformar logos de empresas a URLs (CloudFront o S3 presigned)
    const favoritesWithProcessedLogos = await Promise.all(
      favorites.map(async (favorite) => {
        if (
          favorite.job?.empresa?.logo &&
          !favorite.job.empresa.logo.startsWith("http")
        ) {
          try {
            if (this.cloudFrontSigner.isCloudFrontConfigured()) {
              const logoPath = favorite.job.empresa.logo.startsWith("/")
                ? favorite.job.empresa.logo
                : `/${favorite.job.empresa.logo}`;
              const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(logoPath);
              if (
                cloudFrontUrl &&
                cloudFrontUrl.startsWith("https://") &&
                !cloudFrontUrl.includes("https:///")
              ) {
                favorite.job.empresa.logo = cloudFrontUrl;
              } else {
                favorite.job.empresa.logo = await this.s3UploadService.getObjectUrl(
                  favorite.job.empresa.logo,
                  3600
                );
              }
            } else {
              favorite.job.empresa.logo = await this.s3UploadService.getObjectUrl(
                favorite.job.empresa.logo,
                3600
              );
            }
          } catch (error) {
            console.error("Error generando URL para logo en favoritos de trabajos:", error);
          }
        }
        return favorite;
      })
    );

    return favoritesWithProcessedLogos;
  }

  async listCompanyFavorites(userId: string) {
    const postulante = await this.findPostulanteId(userId);
    const favorites = await this.prisma.companyFavorite.findMany({
      where: { postulanteId: postulante.id },
      include: { empresa: true },
      orderBy: { createdAt: "desc" },
    });

    // Transformar logos a URLs (CloudFront o S3 presigned)
    const favoritesWithProcessedLogos = await Promise.all(
      favorites.map(async (favorite) => {
        if (favorite.empresa?.logo && !favorite.empresa.logo.startsWith("http")) {
          try {
            if (this.cloudFrontSigner.isCloudFrontConfigured()) {
              const logoPath = favorite.empresa.logo.startsWith("/")
                ? favorite.empresa.logo
                : `/${favorite.empresa.logo}`;
              const cloudFrontUrl = this.cloudFrontSigner.getCloudFrontUrl(logoPath);
              if (
                cloudFrontUrl &&
                cloudFrontUrl.startsWith("https://") &&
                !cloudFrontUrl.includes("https:///")
              ) {
                favorite.empresa.logo = cloudFrontUrl;
              } else {
                favorite.empresa.logo = await this.s3UploadService.getObjectUrl(
                  favorite.empresa.logo,
                  3600
                );
              }
            } else {
              favorite.empresa.logo = await this.s3UploadService.getObjectUrl(
                favorite.empresa.logo,
                3600
              );
            }
          } catch (error) {
            console.error("Error generando URL para logo en favoritos:", error);
          }
        }
        return favorite;
      })
    );

    return favoritesWithProcessedLogos;
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
