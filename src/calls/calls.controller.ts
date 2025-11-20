import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { CallsService } from "./calls.service";
import { InitiateCallDto, CallResponseDto } from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("calls")
@Controller("api/calls")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Post()
  @ApiOperation({ summary: "Iniciar una nueva llamada" })
  @ApiResponse({ status: 201, type: CallResponseDto })
  async initiateCall(@Req() req: any, @Body() dto: InitiateCallDto) {
    const call = await this.callsService.initiateCall(req.user?.sub, dto);
    return createResponse({
      success: true,
      message: "Llamada iniciada",
      data: call,
    });
  }

  @Patch(":id/accept")
  @ApiOperation({ summary: "Aceptar una llamada entrante" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async acceptCall(@Req() req: any, @Param("id") callId: string) {
    const call = await this.callsService.acceptCall(req.user?.sub, callId);
    return createResponse({
      success: true,
      message: "Llamada aceptada",
      data: call,
    });
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Rechazar una llamada entrante" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async rejectCall(@Req() req: any, @Param("id") callId: string) {
    const call = await this.callsService.rejectCall(req.user?.sub, callId);
    return createResponse({
      success: true,
      message: "Llamada rechazada",
      data: call,
    });
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancelar una llamada saliente" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async cancelCall(@Req() req: any, @Param("id") callId: string) {
    const call = await this.callsService.cancelCall(req.user?.sub, callId);
    return createResponse({
      success: true,
      message: "Llamada cancelada",
      data: call,
    });
  }

  @Patch(":id/end")
  @ApiOperation({ summary: "Finalizar una llamada en progreso" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async endCall(@Req() req: any, @Param("id") callId: string) {
    const call = await this.callsService.endCall(req.user?.sub, callId);
    return createResponse({
      success: true,
      message: "Llamada finalizada",
      data: call,
    });
  }

  @Get("history")
  @ApiOperation({ summary: "Obtener historial de llamadas" })
  @ApiResponse({ status: 200, type: [CallResponseDto] })
  async getCallHistory(@Req() req: any) {
    const calls = await this.callsService.getCallHistory(req.user?.sub);
    return createResponse({
      success: true,
      message: "Historial de llamadas obtenido",
      data: calls,
    });
  }

  @Get("active")
  @ApiOperation({ summary: "Obtener llamada activa" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async getActiveCall(@Req() req: any) {
    const call = await this.callsService.getActiveCall(req.user?.sub);
    return createResponse({
      success: true,
      message: call ? "Llamada activa encontrada" : "No hay llamada activa",
      data: call,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener información de una llamada" })
  @ApiResponse({ status: 200, type: CallResponseDto })
  async getCallById(@Param("id") callId: string) {
    const call = await this.callsService.getCallById(callId);
    return createResponse({
      success: true,
      message: "Información de llamada obtenida",
      data: call,
    });
  }
}
