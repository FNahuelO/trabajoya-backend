import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Req,
  UseGuards,
  Res,
  Query,
} from "@nestjs/common";
import { PostulantesService } from "./postulantes.service";
import { AtsService } from "./ats.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { Response } from "express";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("postulantes")
@Controller("api/postulantes")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostulantesController {
  constructor(
    private service: PostulantesService,
    private atsService: AtsService,
    private prisma: PrismaService
  ) {}

  @Get("profile")
  me(@Req() req: any) {
    return this.service.getByUser(req.user?.sub);
  }

  @Post("profile")
  create(@Req() req: any, @Body() dto: any) {
    return this.service.createByUser(req.user?.sub, dto);
  }

  @Put("profile")
  update(@Req() req: any, @Body() dto: any) {
    return this.service.updateByUser(req.user?.sub, dto);
  }

  /**
   * Aplicar datos extraídos del CV al perfil
   */
  @Post("profile/apply-extracted-data")
  async applyExtractedData(@Req() req: any, @Body() dto: any) {
    return this.service.applyExtractedCVData(req.user?.sub, dto);
  }

  @Get("notifications")
  async getNotificationPreferences(@Req() req: any) {
    const preferences = await this.service.getNotificationPreferences(
      req.user?.sub,
    );
    return createResponse({
      success: true,
      message: "Preferencias obtenidas correctamente",
      data: preferences,
    });
  }

  @Put("notifications")
  async updateNotificationPreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const preferences = await this.service.updateNotificationPreferences(
      req.user?.sub,
      dto,
    );
    return createResponse({
      success: true,
      message: "Preferencias actualizadas correctamente",
      data: preferences,
    });
  }

  @Post("applications/:jobId")
  applyToJob(
    @Req() req: any,
    @Param("jobId") jobId: string,
    @Body() dto: { coverLetter?: string }
  ) {
    return this.service.applyToJob(req.user?.sub, jobId, dto.coverLetter);
  }

  @Get("applications")
  getApplications(@Req() req: any) {
    return this.service.getApplications(req.user?.sub);
  }

  @Delete("applications/:id")
  async deleteApplication(@Req() req: any, @Param("id") id: string) {
    await this.service.deleteApplication(req.user?.sub, id);
    return createResponse({
      success: true,
      message: "Postulación eliminada correctamente",
    });
  }

  @Patch("applications/:id")
  async updateApplicationCoverLetter(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { coverLetter?: string }
  ) {
    const updated = await this.service.updateApplicationCoverLetter(
      req.user?.sub,
      id,
      dto.coverLetter || ""
    );
    return createResponse({
      success: true,
      message: "Carta de presentación actualizada correctamente",
      data: updated,
    });
  }

  @Post("experiences")
  addExperience(@Req() req: any, @Body() dto: any) {
    return this.service.addExperience(req.user?.sub, dto);
  }

  @Put("experiences/:id")
  updateExperience(@Req() req: any, @Param("id") id: string, @Body() dto: any) {
    return this.service.updateExperience(req.user?.sub, id, dto);
  }

  @Delete("experiences/:id")
  deleteExperience(@Req() req: any, @Param("id") id: string) {
    return this.service.deleteExperience(req.user?.sub, id);
  }

  @Post("education")
  addEducation(@Req() req: any, @Body() dto: any) {
    return this.service.addEducation(req.user?.sub, dto);
  }

  @Put("education/:id")
  updateEducation(@Req() req: any, @Param("id") id: string, @Body() dto: any) {
    return this.service.updateEducation(req.user?.sub, id, dto);
  }

  @Delete("education/:id")
  deleteEducation(@Req() req: any, @Param("id") id: string) {
    return this.service.deleteEducation(req.user?.sub, id);
  }

  /**
   * Exportar perfil en formato JSON-LD (schema.org) para ATS
   */
  @Get("profile/export/json-ld")
  async exportJsonLd(@Req() req: any, @Res() res: Response) {
    const profile = await this.service.getByUser(req.user?.sub);
    const jsonLd = await this.atsService.generateJsonLdProfile(profile.id);

    res.setHeader("Content-Type", "application/ld+json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="profile-${profile.id}.jsonld"`
    );
    return res.json(jsonLd);
  }

  /**
   * Exportar perfil en formato HR-XML para ATS
   */
  @Get("profile/export/hr-xml")
  async exportHrXml(@Req() req: any, @Res() res: Response) {
    const profile = await this.service.getByUser(req.user?.sub);
    const xml = await this.atsService.generateHrXmlProfile(profile.id);

    res.setHeader("Content-Type", "application/xml");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume-${profile.id}.xml"`
    );
    return res.send(xml);
  }

  /**
   * Exportar perfil en formato JSON estructurado para ATS
   */
  @Get("profile/export/ats-json")
  async exportAtsJson(@Req() req: any) {
    const profile = await this.service.getByUser(req.user?.sub);
    const atsProfile = await this.atsService.generateAtsJsonProfile(profile.id);

    return createResponse({
      success: true,
      message: "Perfil exportado correctamente",
      data: atsProfile,
    });
  }

  /**
   * Actualizar habilidades normalizadas
   */
  @Post("profile/normalize-skills")
  async normalizeSkills(@Req() req: any) {
    const profile = await this.service.getByUser(req.user?.sub);
    const normalized = await this.atsService.updateNormalizedSkills(profile.id);

    return createResponse({
      success: true,
      message: "Habilidades normalizadas correctamente",
      data: { normalizedSkills: normalized },
    });
  }

  /**
   * Agregar certificación
   */
  @Post("certifications")
  async addCertification(@Req() req: any, @Body() dto: any) {
    const profile = await this.service.getByUser(req.user?.sub);

    const certification = await this.prisma.certification.create({
      data: {
        postulanteId: profile.id,
        name: dto.name,
        issuer: dto.issuer,
        issueDate: new Date(dto.issueDate),
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
        credentialId: dto.credentialId,
        credentialUrl: dto.credentialUrl,
        description: dto.description,
      },
    });

    return createResponse({
      success: true,
      message: "Certificación agregada correctamente",
      data: certification,
    });
  }

  /**
   * Obtener certificaciones
   */
  @Get("certifications")
  async getCertifications(@Req() req: any) {
    const profile = await this.service.getByUser(req.user?.sub);

    const certifications = await this.prisma.certification.findMany({
      where: { postulanteId: profile.id },
      orderBy: { issueDate: "desc" },
    });

    return createResponse({
      success: true,
      message: "Certificaciones obtenidas correctamente",
      data: certifications,
    });
  }

  /**
   * Actualizar certificación
   */
  @Put("certifications/:id")
  async updateCertification(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: any
  ) {
    const profile = await this.service.getByUser(req.user?.sub);

    // Verificar que la certificación pertenece al usuario
    const cert = await this.prisma.certification.findFirst({
      where: { id, postulanteId: profile.id },
    });

    if (!cert) {
      return createResponse({
        success: false,
        message: "Certificación no encontrada",
      });
    }

    const updated = await this.prisma.certification.update({
      where: { id },
      data: {
        name: dto.name,
        issuer: dto.issuer,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
        credentialId: dto.credentialId,
        credentialUrl: dto.credentialUrl,
        description: dto.description,
      },
    });

    return createResponse({
      success: true,
      message: "Certificación actualizada correctamente",
      data: updated,
    });
  }

  /**
   * Eliminar certificación
   */
  @Delete("certifications/:id")
  async deleteCertification(@Req() req: any, @Param("id") id: string) {
    const profile = await this.service.getByUser(req.user?.sub);

    // Verificar que la certificación pertenece al usuario
    const cert = await this.prisma.certification.findFirst({
      where: { id, postulanteId: profile.id },
    });

    if (!cert) {
      return createResponse({
        success: false,
        message: "Certificación no encontrada",
      });
    }

    await this.prisma.certification.delete({
      where: { id },
    });

    return createResponse({
      success: true,
      message: "Certificación eliminada correctamente",
    });
  }

  /**
   * Eliminar video de presentación
   */
  @Delete("profile/video")
  async deleteVideo(@Req() req: any) {
    await this.service.deleteVideo(req.user?.sub);
    return createResponse({
      success: true,
      message: "Video eliminado correctamente",
    });
  }
}
