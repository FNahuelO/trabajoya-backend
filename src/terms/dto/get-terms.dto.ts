import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { TermsType } from "@prisma/client";

export class GetTermsDto {
  @ApiProperty({
    enum: TermsType,
    required: false,
    description:
      "Tipo de términos a obtener. Si no se especifica, se obtiene según el rol del usuario",
  })
  @IsOptional()
  @IsEnum(TermsType)
  type?: TermsType;
}
