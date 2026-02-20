import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ description: "Notificaciones generales por email", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailGeneral?: boolean;

  @ApiProperty({ description: "Notificaciones generales push", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushGeneral?: boolean;

  @ApiProperty({ description: "Estado de postulaciones por email", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailEstadoPostulaciones?: boolean;

  @ApiProperty({ description: "Estado de postulaciones push", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushEstadoPostulaciones?: boolean;

  @ApiProperty({ description: "Mensajes de empresas por email", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailMensajesEmpresas?: boolean;

  @ApiProperty({ description: "Mensajes de empresas push", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushMensajesEmpresas?: boolean;

  @ApiProperty({ description: "Nuevos empleos de empresas seguidas por email", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailNuevosEmpleosSeguidos?: boolean;

  @ApiProperty({ description: "Nuevos empleos de empresas seguidas push", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushNuevosEmpleosSeguidos?: boolean;

  @ApiProperty({ description: "Empleos recomendados por email", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailRecomendados?: boolean;

  @ApiProperty({ description: "Empleos recomendados push", default: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushRecomendados?: boolean;
}
