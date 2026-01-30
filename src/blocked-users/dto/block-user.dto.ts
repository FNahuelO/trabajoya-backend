import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

/**
 * DTO para bloquear un usuario
 * Requerido por Google Play para cumplir con políticas de seguridad
 */
export class BlockUserDto {
  @ApiProperty({
    description: "ID del usuario a bloquear",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  blockedUserId: string;
}



