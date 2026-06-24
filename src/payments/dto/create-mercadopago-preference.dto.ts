import { IsIn, IsOptional, IsString, IsUUID, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMercadoPagoPreferenceDto {
  @ApiProperty({ description: "ID del empleo a publicar" })
  @IsString()
  jobId: string;

  @ApiProperty({ description: "ID del plan seleccionado" })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({ enum: ["mobile", "web"], default: "mobile" })
  @IsOptional()
  @IsIn(["mobile", "web"])
  platform?: "mobile" | "web";

  @ApiPropertyOptional({
    description: "Si el pago se inició desde la app móvil (vuelta por deep link)",
  })
  @IsOptional()
  @IsBoolean()
  fromApp?: boolean;
}
