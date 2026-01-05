import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsEnum } from "class-validator";
import { TermsType } from "@prisma/client";

export class AcceptTermsDto {
  @ApiProperty({
    enum: TermsType,
    description: "Tipo de términos aceptados",
  })
  @IsEnum(TermsType)
  type: TermsType;

  @ApiProperty({
    description: "Versión de los términos aceptados",
    example: "1.0.0",
  })
  @IsString()
  version: string;
}
