import { ApiProperty } from "@nestjs/swagger";

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ default: true })
  emailGeneral: boolean;

  @ApiProperty({ default: true })
  pushGeneral: boolean;

  @ApiProperty({ default: true })
  emailEstadoPostulaciones: boolean;

  @ApiProperty({ default: true })
  pushEstadoPostulaciones: boolean;

  @ApiProperty({ default: true })
  emailMensajesEmpresas: boolean;

  @ApiProperty({ default: true })
  pushMensajesEmpresas: boolean;

  @ApiProperty({ default: true })
  emailNuevosEmpleosSeguidos: boolean;

  @ApiProperty({ default: true })
  pushNuevosEmpleosSeguidos: boolean;

  @ApiProperty({ default: true })
  emailRecomendados: boolean;

  @ApiProperty({ default: true })
  pushRecomendados: boolean;
}
