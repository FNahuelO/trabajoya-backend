import { IsBoolean, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class NotificationPreferencesDto {
  // Preferencias para Postulantes
  @ApiProperty({
    description: "Notificaciones de nuevos empleos",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  newJobs?: boolean;

  @ApiProperty({
    description: "Notificaciones de mensajes de empresas",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  companyMessages?: boolean;

  @ApiProperty({
    description: "Notificaciones de actualizaciones de postulaciones",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  applicationUpdates?: boolean;

  @ApiProperty({
    description: "Notificaciones de consejos y recomendaciones",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  tipsAdvice?: boolean;

  @ApiProperty({
    description: "Notificaciones de llamadas",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  calls?: boolean;

  // Preferencias para Empresas
  @ApiProperty({
    description: "Notificaciones de nuevas postulaciones",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  newApplications?: boolean;

  @ApiProperty({
    description: "Notificaciones de mensajes de postulantes",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  applicantMessages?: boolean;

  @ApiProperty({
    description: "Notificaciones de recordatorios de entrevistas",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  interviewReminders?: boolean;

  @ApiProperty({
    description: "Notificaciones de actualizaciones del sistema",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  systemUpdates?: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    description: "Preferencias de notificaciones del usuario",
  })
  preferences: {
    // Postulante
    newJobs?: boolean;
    companyMessages?: boolean;
    applicationUpdates?: boolean;
    tipsAdvice?: boolean;
    calls?: boolean;
    // Empresa
    newApplications?: boolean;
    applicantMessages?: boolean;
    interviewReminders?: boolean;
    systemUpdates?: boolean;
  };
}

