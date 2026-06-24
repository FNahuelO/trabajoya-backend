import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ExchangeWebHandoffDto {
  @ApiProperty({ description: "Código de un solo uso generado por la app" })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  code: string;
}
