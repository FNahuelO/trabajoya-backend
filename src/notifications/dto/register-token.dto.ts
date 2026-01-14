import { IsString, IsOptional, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterTokenDto {
  @ApiProperty({
    description: "Token de push de Expo",
    example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  })
  @IsString()
  pushToken: string;

  @ApiProperty({
    description: "Plataforma del dispositivo",
    example: "android",
    enum: ["ios", "android", "web"],
  })
  @IsString()
  @IsIn(["ios", "android", "web"])
  platform: string;

  @ApiProperty({
    description: "ID del dispositivo (opcional)",
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class UnregisterTokenDto {
  @ApiProperty({
    description: "Token de push a desregistrar",
    example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  })
  @IsString()
  pushToken: string;
}

