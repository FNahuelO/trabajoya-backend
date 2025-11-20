import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PostulantesService } from "./postulantes.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";

@ApiTags("postulantes")
@Controller("api/postulantes")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostulantesController {
  constructor(private service: PostulantesService) {}

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

  @Get("notifications")
  getNotificationPreferences(@Req() req: any) {
    return this.service.getNotificationPreferences(req.user?.sub);
  }

  @Put("notifications")
  updateNotificationPreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto
  ) {
    return this.service.updateNotificationPreferences(req.user?.sub, dto);
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
}
