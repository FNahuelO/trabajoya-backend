import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateWebHandoffDto {
  @ApiProperty({
    description: "Ruta interna del portal web a la que volver tras el handoff",
    example: "/publicaciones?payJobId=uuid&planId=uuid&fromApp=1",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  returnPath: string;
}
