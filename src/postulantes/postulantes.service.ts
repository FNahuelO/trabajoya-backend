import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
// import { I18nService } from "nestjs-i18n"; // Temporalmente deshabilitado

@Injectable()
export class PostulantesService {
  constructor(private prisma: PrismaService) {}

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
      additionalInformation: dto.additionalInformation || null,
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

    return {
      id: profile.id,
      userId: profile.userId,
      firstName,
      lastName,
      email: (profile as any).user?.email || "",
      city: profile.city,
      country: profile.country,
      skills: profile.skills,
      avatar: profile.profilePicture,
      cv: profile.cvUrl,
      videoUrl: profile.videoUrl,
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
      province: profile.province,
      postalCode: profile.postalCode,
      // Professional profile
      searchingFirstJob: profile.searchingFirstJob,
      resumeTitle: profile.resumeTitle,
      professionalDescription: profile.professionalDescription,
      employmentStatus: profile.employmentStatus,
      minimumSalary: profile.minimumSalary,
      additionalInformation: profile.additionalInformation,
    };
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
      "province",
      "postalCode",
      // Professional profile
      "searchingFirstJob",
      "resumeTitle",
      "professionalDescription",
      "employmentStatus",
      "minimumSalary",
      "additionalInformation",
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

    return this.prisma.postulanteProfile.update({
      where: { userId },
      data: updateData,
    });
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
}
