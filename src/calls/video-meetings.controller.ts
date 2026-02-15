import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { VideoMeetingsService } from "./video-meetings.service";
import {
  CreateVideoMeetingDto,
  UpdateVideoMeetingDto,
  VideoMeetingResponseDto,
} from "./dto/video-meeting.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { EmpresaGuard } from "../common/guards/empresa.guard";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("video-meetings")
@Controller("api/video-meetings")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoMeetingsController {
  constructor(private videoMeetingsService: VideoMeetingsService) {}

  @Post()
  @UseGuards(EmpresaGuard)
  @ApiOperation({ summary: "Crear una nueva reunión de videollamada (solo empresas)" })
  @ApiResponse({ status: 201, type: VideoMeetingResponseDto })
  async createVideoMeeting(
    @Req() req: any,
    @Body() dto: CreateVideoMeetingDto
  ) {
    const meeting = await this.videoMeetingsService.createVideoMeeting(
      req.user?.sub,
      dto
    );
    return createResponse({
      success: true,
      message: "Reunión creada exitosamente",
      data: meeting,
    });
  }

  @Get()
  @ApiOperation({ summary: "Obtener todas las reuniones del usuario" })
  @ApiResponse({ status: 200, type: [VideoMeetingResponseDto] })
  async getUserMeetings(@Req() req: any) {
    const meetings = await this.videoMeetingsService.getUserMeetings(
      req.user?.sub
    );
    return createResponse({
      success: true,
      message: "Reuniones obtenidas exitosamente",
      data: meetings,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener una reunión por ID" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async getMeetingById(@Req() req: any, @Param("id") meetingId: string) {
    const meeting = await this.videoMeetingsService.getMeetingById(
      req.user?.sub,
      meetingId
    );
    return createResponse({
      success: true,
      message: "Reunión obtenida exitosamente",
      data: meeting,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async updateMeeting(
    @Req() req: any,
    @Param("id") meetingId: string,
    @Body() dto: UpdateVideoMeetingDto
  ) {
    const meeting = await this.videoMeetingsService.updateMeeting(
      req.user?.sub,
      meetingId,
      dto
    );
    return createResponse({
      success: true,
      message: "Reunión actualizada exitosamente",
      data: meeting,
    });
  }

  @Patch(":id/accept")
  @ApiOperation({ summary: "Aceptar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async acceptMeeting(@Req() req: any, @Param("id") meetingId: string) {
    const meeting = await this.videoMeetingsService.acceptMeeting(
      req.user?.sub,
      meetingId
    );
    return createResponse({
      success: true,
      message: "Reunión aceptada exitosamente",
      data: meeting,
    });
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Rechazar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async rejectMeeting(@Req() req: any, @Param("id") meetingId: string) {
    const meeting = await this.videoMeetingsService.rejectMeeting(
      req.user?.sub,
      meetingId
    );
    return createResponse({
      success: true,
      message: "Reunión rechazada",
      data: meeting,
    });
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancelar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async cancelMeeting(@Req() req: any, @Param("id") meetingId: string) {
    const meeting = await this.videoMeetingsService.cancelMeeting(
      req.user?.sub,
      meetingId
    );
    return createResponse({
      success: true,
      message: "Reunión cancelada exitosamente",
      data: meeting,
    });
  }

  @Patch(":id/start")
  @ApiOperation({ summary: "Iniciar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async startMeeting(
    @Req() req: any,
    @Param("id") meetingId: string,
    @Body() body: { callId: string }
  ) {
    const meeting = await this.videoMeetingsService.startMeeting(
      req.user?.sub,
      meetingId,
      body.callId
    );
    return createResponse({
      success: true,
      message: "Reunión iniciada exitosamente",
      data: meeting,
    });
  }

  @Patch(":id/complete")
  @ApiOperation({ summary: "Finalizar una reunión" })
  @ApiResponse({ status: 200, type: VideoMeetingResponseDto })
  async completeMeeting(@Req() req: any, @Param("id") meetingId: string) {
    const meeting = await this.videoMeetingsService.completeMeeting(
      req.user?.sub,
      meetingId
    );
    return createResponse({
      success: true,
      message: "Reunión finalizada exitosamente",
      data: meeting,
    });
  }

  @Get(":id/ics")
  @ApiOperation({
    summary: "Descargar archivo .ics (iCalendar) de una reunión",
    description:
      "Genera y descarga un archivo .ics que puede ser importado a cualquier calendario (Google Calendar, Outlook, Apple Calendar, etc.)",
  })
  @ApiResponse({
    status: 200,
    description: "Archivo .ics descargado exitosamente",
    content: {
      "text/calendar": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async downloadICS(
    @Req() req: any,
    @Param("id") meetingId: string,
    @Res() res: Response
  ) {
    const icsContent = await this.videoMeetingsService.generateICSFile(
      req.user?.sub,
      meetingId
    );

    // Configurar headers para descarga de archivo
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="videollamada-${meetingId}.ics"`
    );
    res.setHeader("Content-Length", Buffer.byteLength(icsContent, "utf-8"));

    res.send(icsContent);
  }
}
