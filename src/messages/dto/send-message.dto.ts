import {
  IsString,
  IsNotEmpty,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendMessageDto {
  @ApiProperty({
    description: "ID del usuario destinatario del mensaje",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({
    description: "Contenido del mensaje",
    example: "Hola, me interesa la posición de desarrollador frontend",
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: "El mensaje no puede estar vacío" })
  @MaxLength(1000, {
    message: "El mensaje no puede exceder los 1000 caracteres",
  })
  message: string;
}
