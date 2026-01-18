import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AtsService } from "./ats.service";
import { GcpCdnService } from "../upload/gcp-cdn.service";
import { S3UploadService } from "../upload/s3-upload.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class PostulantesService {
  constructor(
    private prisma: PrismaService,
    private atsService: AtsService,
    private gcpCdnService: GcpCdnService,
    private s3UploadService: S3UploadService
  ) {}

  async createByUser(userId: string, dto: any) {
    const createData: any = {
      userId,
      fullName:
        dto.fullName || `${dto.firstName || ""} ${dto.lastName || ""}`.trim(),
      city: dto.city || null,
      country: dto.country || null,
      skills: dto.skills || [],
      profilePicture: dto.avatar || null,
      cvUrl: dto.cv || null,
      videoUrl: dto.videoUrl || null,
      // Personal data
      phone: dto.phone || null,
      alternatePhone: dto.alternatePhone || null,
      address: dto.address || null,
      calle: dto.calle || null,
      numero: dto.numero || null,
      piso: dto.piso || null,
      depto: dto.depto || null,
      province: dto.province || null,
      postalCode: dto.postalCode || null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      gender: dto.gender || null,
      nationality: dto.nationality || null,
      maritalStatus: dto.maritalStatus || null,
      documentType: dto.documentType || null,
      documentNumber: dto.documentNumber || null,
      hasOwnVehicle: dto.hasOwnVehicle || false,
      hasDriverLicense: dto.hasDriverLicense || false,
      // Professional profile
      searchingFirstJob: dto.searchingFirstJob || false,
      resumeTitle: dto.resumeTitle || null,
      professionalDescription: dto.professionalDescription || null,
      employmentStatus: dto.employmentStatus || null,
      minimumSalary: dto.minimumSalary || null,
      coverLetter: dto.coverLetter || null,
      additionalInformation: dto.additionalInformation || null,
      // Languages
      languages: dto.languages || null,
    };

    return this.prisma.postulanteProfile.create({ data: createData });
  }

  async getByUser(userId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
      include: {
        experiences: true,
        education: true,
        applications: {
          include: {
            job: {
              include: {
                empresa: {
                  select: {
                    companyName: true,
                    logo: true,
                    ciudad: true,
                    provincia: true,
                    pais: true,
                  } as any,
                },
              },
            },
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    // Mapear campos de Prisma al formato esperado por el frontend
    const fullNameParts = profile.fullName.split(" ");
    const firstName = fullNameParts[0] || "";
    const lastName = fullNameParts.slice(1).join(" ") || "";

    // Transformar el avatar key en una URL válida (GCP CDN o Storage directo)
    let avatarUrl = profile.profilePicture;
    if (avatarUrl && !avatarUrl.startsWith("http")) {
      try {
        // Usar GCP CDN si está configurado, si no usar URL firmada
        if (this.gcpCdnService.isCdnConfigured()) {
          avatarUrl = await this.gcpCdnService.getCdnUrl(profile.profilePicture);
        } else {
          avatarUrl = await this.s3UploadService.getObjectUrl(
            profile.profilePicture,
            3600
          );
        }
      } catch (error) {
        console.error("Error generando URL para avatar:", error);
        // Si falla, mantener el key original para que el frontend pueda intentar construirla
      }
    }

    // Transformar el videoUrl key en una URL válida (GCP CDN o Storage directo)
    let videoUrl = profile.videoUrl;
    if (videoUrl && !videoUrl.startsWith("http")) {
      try {
        // Usar GCP CDN si está configurado, si no usar URL firmada
        if (this.gcpCdnService.isCdnConfigured()) {
          videoUrl = await this.gcpCdnService.getCdnUrl(profile.videoUrl);
        } else {
          videoUrl = await this.s3UploadService.getObjectUrl(
            profile.videoUrl,
            3600
          );
        }
      } catch (error) {
        console.error("Error generando URL para video:", error);
        // Si falla, mantener el key original para que el frontend pueda intentar construirla
      }
    }

    return {
      id: profile.id,
      userId: profile.userId,
      firstName,
      lastName,
      email: (profile as any).user?.email || "",
      city: profile.city,
      country: profile.country,
      skills: profile.skills,
      avatar: avatarUrl,
      cv: profile.cvUrl,
      videoUrl: videoUrl,
      experiences: (profile as any).experiences || [],
      education: (profile as any).education || [],
      // Personal data
      birthDate: profile.birthDate?.toISOString(),
      gender: profile.gender,
      nationality: profile.nationality,
      maritalStatus: profile.maritalStatus,
      documentType: profile.documentType,
      documentNumber: profile.documentNumber,
      hasOwnVehicle: profile.hasOwnVehicle,
      hasDriverLicense: profile.hasDriverLicense,
      phone: profile.phone,
      alternatePhone: profile.alternatePhone,
      address: profile.address,
      calle: profile.calle,
      numero: profile.numero,
      piso: profile.piso,
      depto: profile.depto,
      province: profile.province,
      postalCode: profile.postalCode,
      // Professional profile
      searchingFirstJob: profile.searchingFirstJob,
      resumeTitle: profile.resumeTitle,
      professionalDescription: profile.professionalDescription,
      employmentStatus: profile.employmentStatus,
      minimumSalary: profile.minimumSalary,
      coverLetter: profile.coverLetter,
      additionalInformation: profile.additionalInformation,
      // Languages
      languages: profile.languages ? (profile.languages as any) : [],
    };
  }

  /**
   * Eliminar video de presentación del perfil y de S3
   */
  async deleteVideo(userId: string): Promise<void> {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Perfil no encontrado");
    }

    if (!profile.videoUrl) {
      throw new BadRequestException("No hay video para eliminar");
    }

    try {
      // Extraer la key de S3 del videoUrl
      // El videoUrl puede ser:
      // 1. Una URL completa de CloudFront (https://d1234.cloudfront.net/videos/userId/uuid.mp4)
      // 2. Solo la key (videos/userId/uuid.mp4)
      let s3Key = profile.videoUrl;

      // Si es una URL completa, extraer la key
      if (s3Key.startsWith("http")) {
        try {
          const url = new URL(s3Key);
          // La key es la parte después del dominio
          s3Key = url.pathname.startsWith("/") ? url.pathname.substring(1) : url.pathname;
        } catch (error) {
          console.error("Error al parsear URL del video:", error);
          // Si falla, intentar usar el videoUrl directamente
        }
      }

      // Eliminar el archivo de S3
      try {
        await this.s3UploadService.deleteObject(s3Key);
        console.log(`Video eliminado de S3: ${s3Key}`);
      } catch (s3Error: any) {
        // Si el archivo no existe en S3, continuar de todas formas
        if (s3Error.name !== "NotFound" && s3Error.$metadata?.httpStatusCode !== 404) {
          console.error("Error al eliminar video de S3:", s3Error);
          // Continuar para actualizar el perfil de todas formas
        }
      }

      // Actualizar el perfil poniendo videoUrl en null
      await this.prisma.postulanteProfile.update({
        where: { userId },
        data: { videoUrl: null },
      });
    } catch (error: any) {
      console.error("Error al eliminar video:", error);
      throw new BadRequestException(
        error.message || "Error al eliminar el video"
      );
    }
  }

  async updateByUser(userId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    // Mapear campos del frontend al esquema de Prisma
    const updateData: any = {};

    // Mapear fullName desde firstName/lastName
    if (dto.firstName || dto.lastName) {
      const firstName = dto.firstName || "";
      const lastName = dto.lastName || "";
      updateData.fullName = `${firstName} ${lastName}`.trim();
    }

    // Campos directos simples
    const directFields = [
      "city",
      "country",
      "skills",
      "videoUrl",
      // Personal data
      "birthDate",
      "gender",
      "nationality",
      "maritalStatus",
      "documentType",
      "documentNumber",
      "hasOwnVehicle",
      "hasDriverLicense",
      "phone",
      "alternatePhone",
      "address",
      "calle",
      "numero",
      "piso",
      "depto",
      "province",
      "postalCode",
      // Professional profile
      "searchingFirstJob",
      "resumeTitle",
      "professionalDescription",
      "employmentStatus",
      "minimumSalary",
      "coverLetter",
      "additionalInformation",
      // ATS-friendly fields
      "linkedInUrl",
      "portfolioUrl",
      "websiteUrl",
      "githubUrl",
      "languages",
    ];

    for (const field of directFields) {
      if (dto[field] !== undefined) {
        // Convertir birthDate a Date si es necesario
        if (field === "birthDate" && dto[field]) {
          updateData[field] = new Date(dto[field]);
        } else {
          updateData[field] = dto[field];
        }
      }
    }

    // Mapear profilePicture desde avatar
    if (dto.avatar !== undefined) {
      updateData.profilePicture = dto.avatar || null;
    }

    // Mapear cvUrl desde cv
    if (dto.cv !== undefined) {
      updateData.cvUrl = dto.cv || null;
    }

    // Manejar experiencias
    if (dto.experiences !== undefined) {
      const experiences = dto.experiences || [];

      // Eliminar todas las experiencias existentes
      await this.prisma.experience.deleteMany({
        where: { postulanteId: profile.id },
      });

      // Crear las nuevas experiencias
      if (experiences.length > 0) {
        await this.prisma.experience.createMany({
          data: experiences.map((exp: any) => ({
            postulanteId: profile.id,
            position: exp.position || "",
            company: exp.company || "",
            startDate: new Date(exp.startDate),
            endDate: exp.endDate ? new Date(exp.endDate) : null,
            isCurrent: exp.isCurrent || false,
            experienceLevel: exp.experienceLevel || null,
            companyCountry: exp.companyCountry || null,
            jobArea: exp.jobArea || null,
            companyActivity: exp.companyActivity || null,
            description: exp.description || null,
            peopleInCharge: exp.peopleInCharge || null,
          })),
        });
      }
    }

    // Manejar educación
    if (dto.education !== undefined) {
      const education = dto.education || [];

      // Eliminar todas las educaciones existentes
      await this.prisma.education.deleteMany({
        where: { postulanteId: profile.id },
      });

      // Crear las nuevas educaciones
      if (education.length > 0) {
        await this.prisma.education.createMany({
          data: education.map((edu: any) => ({
            postulanteId: profile.id,
            degree: edu.degree || "",
            institution: edu.institution || "",
            country: edu.country || null,
            studyArea: edu.studyArea || null,
            studyType: edu.studyType || null,
            status: edu.status || null,
            startDate: new Date(edu.startDate),
            endDate: edu.endDate ? new Date(edu.endDate) : null,
            isCurrent: edu.isCurrent || false,
            description: edu.description || null,
          })),
        });
      }
    }

    // Normalizar habilidades si se actualizaron
    if (dto.skills !== undefined && Array.isArray(dto.skills)) {
      const normalizedSkills = this.atsService.normalizeSkills(dto.skills);
      updateData.normalizedSkills = normalizedSkills;
    }

    const updatedProfile = await this.prisma.postulanteProfile.update({
      where: { userId },
      data: updateData,
    });

    // Si se actualizaron habilidades y no se proporcionaron normalizedSkills, actualizarlas
    if (
      dto.skills !== undefined &&
      !updateData.normalizedSkills &&
      updatedProfile.skills
    ) {
      const normalizedSkills = this.atsService.normalizeSkills(
        updatedProfile.skills
      );
      // Actualizar normalizedSkills en una segunda llamada si el campo existe en el schema
      try {
        await this.prisma.postulanteProfile.update({
          where: { id: updatedProfile.id },
          data: { normalizedSkills: normalizedSkills as any },
        });
        (updatedProfile as any).normalizedSkills = normalizedSkills;
      } catch (error) {
        // Si el campo no existe aún en la BD, ignorar el error
        console.warn("NormalizedSkills field not available yet:", error);
      }
    }

    return updatedProfile;
  }

  async getNotificationPreferences(userId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }
    return (
      profile.notificationPreferences ?? {
        emailGeneral: true,
        pushGeneral: true,
        emailEstadoPostulaciones: true,
        pushEstadoPostulaciones: true,
        emailMensajesEmpresas: true,
        pushMensajesEmpresas: true,
        emailNuevosEmpleosSeguidos: true,
        pushNuevosEmpleosSeguidos: true,
        emailRecomendados: true,
        pushRecomendados: true,
      }
    );
  }

  async updateNotificationPreferences(userId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }
    const updated = await this.prisma.postulanteProfile.update({
      where: { userId },
      data: { notificationPreferences: dto },
      select: { notificationPreferences: true },
    });
    return updated.notificationPreferences;
  }

  async applyToJob(userId: string, jobId: string, coverLetter?: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        "Perfil de postulante no encontrado. Por favor, completa tu perfil primero"
      );
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(
        "El trabajo solicitado no existe o ha sido eliminado"
      );
    }

    // Verificar si ya aplicó
    const existing = await this.prisma.application.findUnique({
      where: {
        postulanteId_jobId: {
          postulanteId: profile.id,
          jobId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        "Ya has aplicado a este trabajo anteriormente"
      );
    }

    return this.prisma.application.create({
      data: {
        postulanteId: profile.id,
        jobId,
        coverLetter,
      },
      include: {
        job: {
          include: {
            empresa: {
              select: {
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
    });
  }

  async getApplications(userId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.application.findMany({
      where: { postulanteId: profile.id },
      orderBy: { appliedAt: "desc" },
      include: {
        job: {
          include: {
            empresa: {
              select: {
                companyName: true,
                logo: true,
                ciudad: true,
                provincia: true,
                pais: true,
              } as any,
            },
          },
        },
      },
    });
  }

  async deleteApplication(userId: string, applicationId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, postulanteId: profile.id },
    });

    if (!application) {
      throw new NotFoundException("Postulación no encontrada");
    }

    return this.prisma.application.delete({
      where: { id: applicationId },
    });
  }

  async updateApplicationCoverLetter(
    userId: string,
    applicationId: string,
    coverLetter: string
  ) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, postulanteId: profile.id },
    });

    if (!application) {
      throw new NotFoundException("Postulación no encontrada");
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { coverLetter },
      include: {
        job: {
          include: {
            empresa: {
              select: {
                companyName: true,
                logo: true,
                ciudad: true,
                provincia: true,
                pais: true,
              } as any,
            },
          },
        },
      },
    });
  }

  async addExperience(userId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const experienceData = {
      position: dto.position,
      company: dto.company,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isCurrent: dto.isCurrent || false,
      description: dto.description || null,
      experienceLevel: dto.experienceLevel || null,
      companyCountry: dto.companyCountry || null,
      jobArea: dto.jobArea || null,
      companyActivity: dto.companyActivity || null,
      peopleInCharge: dto.peopleInCharge || null,
      postulanteId: profile.id,
    };

    return this.prisma.experience.create({
      data: experienceData,
    });
  }

  async updateExperience(userId: string, experienceId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const experience = await this.prisma.experience.findFirst({
      where: { id: experienceId, postulanteId: profile.id },
    });

    if (!experience) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.experience.update({
      where: { id: experienceId },
      data: dto,
    });
  }

  async deleteExperience(userId: string, experienceId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const experience = await this.prisma.experience.findFirst({
      where: { id: experienceId, postulanteId: profile.id },
    });

    if (!experience) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.experience.delete({ where: { id: experienceId } });
  }

  async addEducation(userId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const educationData = {
      degree: dto.degree,
      institution: dto.institution,
      country: dto.country || null,
      studyArea: dto.studyArea || null,
      studyType: dto.studyType || null,
      status: dto.status || null,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isCurrent: dto.isCurrent || false,
      description: dto.description || null,
      postulanteId: profile.id,
    };

    return this.prisma.education.create({
      data: educationData,
    });
  }

  async updateEducation(userId: string, educationId: string, dto: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const education = await this.prisma.education.findFirst({
      where: { id: educationId, postulanteId: profile.id },
    });

    if (!education) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.education.update({
      where: { id: educationId },
      data: dto,
    });
  }

  async deleteEducation(userId: string, educationId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Mensaje de error");
    }

    const education = await this.prisma.education.findFirst({
      where: { id: educationId, postulanteId: profile.id },
    });

    if (!education) {
      throw new NotFoundException("Mensaje de error");
    }

    return this.prisma.education.delete({ where: { id: educationId } });
  }

  /**
   * Aplicar datos extraídos del CV al perfil
   */
  async applyExtractedCVData(userId: string, extractedData: any) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { userId },
      include: { experiences: true, education: true },
    });

    if (!profile) {
      throw new NotFoundException("Perfil no encontrado");
    }

    const updateData: any = {};

    // Actualizar información personal (solo si no existe)
    // Nota: El schema de Prisma tiene fullName, y getByUser lo separa en firstName/lastName para el frontend
    if (
      extractedData.fullName &&
      (!profile.fullName || profile.fullName.trim().length === 0)
    ) {
      updateData.fullName = extractedData.fullName.trim();
    }
    if (extractedData.phone && !profile.phone) {
      updateData.phone = extractedData.phone;
    }
    if (extractedData.address && !profile.address) {
      updateData.address = extractedData.address;
    }
    if (extractedData.city && !profile.city) {
      updateData.city = extractedData.city;
    }
    if (extractedData.province && !profile.province) {
      updateData.province = extractedData.province;
    }
    if (extractedData.country && !profile.country) {
      updateData.country = extractedData.country;
    }
    if (extractedData.postalCode && !profile.postalCode) {
      updateData.postalCode = extractedData.postalCode;
    }

    // Actualizar URLs profesionales
    if (extractedData.linkedInUrl && !profile.linkedInUrl) {
      updateData.linkedInUrl = extractedData.linkedInUrl;
    }
    if (extractedData.githubUrl && !profile.githubUrl) {
      updateData.githubUrl = extractedData.githubUrl;
    }
    if (extractedData.websiteUrl && !profile.websiteUrl) {
      updateData.websiteUrl = extractedData.websiteUrl;
    }
    if (extractedData.portfolioUrl && !profile.portfolioUrl) {
      updateData.portfolioUrl = extractedData.portfolioUrl;
    }

    // Actualizar perfil profesional
    if (extractedData.resumeTitle && !profile.resumeTitle) {
      updateData.resumeTitle = extractedData.resumeTitle;
    }
    if (
      extractedData.professionalDescription &&
      !profile.professionalDescription
    ) {
      updateData.professionalDescription =
        extractedData.professionalDescription;
    }
    if (extractedData.skills && Array.isArray(extractedData.skills)) {
      // Combinar habilidades existentes con las nuevas
      const existingSkills = profile.skills || [];
      const newSkills = extractedData.skills.filter(
        (skill: string) =>
          !existingSkills.some(
            (s: string) => s.toLowerCase() === skill.toLowerCase()
          )
      );
      if (newSkills.length > 0) {
        updateData.skills = [...existingSkills, ...newSkills];
        // Normalizar habilidades
        const normalizedSkills = this.atsService.normalizeSkills(
          updateData.skills
        );
        updateData.normalizedSkills = normalizedSkills;
      }
    }

    // Actualizar perfil si hay cambios
    if (Object.keys(updateData).length > 0) {
      await this.prisma.postulanteProfile.update({
        where: { userId },
        data: updateData,
      });
    }

    // Agregar educación (solo si no existe similar)
    if (extractedData.education && Array.isArray(extractedData.education)) {
      for (const edu of extractedData.education) {
        if (!edu.degree && !edu.institution) continue;

        // Verificar si ya existe una educación similar
        const existingEdu = profile.education.find(
          (e) =>
            (edu.institution &&
              e.institution
                .toLowerCase()
                .includes(edu.institution.toLowerCase())) ||
            (edu.degree &&
              e.degree.toLowerCase().includes(edu.degree.toLowerCase()))
        );

        if (!existingEdu) {
          await this.prisma.education.create({
            data: {
              postulanteId: profile.id,
              degree: edu.degree || "Sin especificar",
              institution: edu.institution || "Sin especificar",
              country: edu.country || null,
              studyArea: edu.studyArea || null,
              studyType: edu.studyType || null,
              status: edu.status || null,
              startDate: edu.startDate ? new Date(edu.startDate) : new Date(),
              endDate: edu.endDate ? new Date(edu.endDate) : null,
              isCurrent: edu.isCurrent || false,
              description: edu.description || null,
              gpa: edu.gpa || null,
              honors: edu.honors || null,
            },
          });
        }
      }
    }

    // Agregar experiencias (solo si no existe similar)
    if (extractedData.experiences && Array.isArray(extractedData.experiences)) {
      for (const exp of extractedData.experiences) {
        if (!exp.position && !exp.company) continue;

        // Verificar si ya existe una experiencia similar
        const existingExp = profile.experiences.find(
          (e) =>
            exp.company &&
            e.company.toLowerCase().includes(exp.company.toLowerCase()) &&
            exp.position &&
            e.position.toLowerCase().includes(exp.position.toLowerCase())
        );

        if (!existingExp) {
          await this.prisma.experience.create({
            data: {
              postulanteId: profile.id,
              position: exp.position || "Sin especificar",
              company: exp.company || "Sin especificar",
              companyCountry: exp.companyCountry || null,
              jobArea: exp.jobArea || null,
              companyActivity: exp.companyActivity || null,
              startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
              endDate: exp.endDate ? new Date(exp.endDate) : null,
              isCurrent: exp.isCurrent || false,
              description: exp.description || null,
              experienceLevel: exp.experienceLevel || null,
              peopleInCharge: null,
            },
          });
        }
      }
    }

    // Retornar el perfil actualizado
    return this.getByUser(userId);
  }
}
