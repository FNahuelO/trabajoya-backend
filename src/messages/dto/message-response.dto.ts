import { ApiProperty } from "@nestjs/swagger";

export class UserInfoDto {
  @ApiProperty({ description: "ID del usuario" })
  id: string;

  @ApiProperty({ description: "Email del usuario" })
  email: string;

  @ApiProperty({
    description: "Tipo de usuario",
    enum: ["POSTULANTE", "EMPRESA"],
  })
  userType: string;

  @ApiProperty({ description: "Información del postulante", required: false })
  postulante?: {
    id: string;
    fullName: string;
    profilePicture?: string;
  };

  @ApiProperty({ description: "Información de la empresa", required: false })
  empresa?: {
    id: string;
    companyName: string;
    logo?: string;
  };
}

export class MessageResponseDto {
  @ApiProperty({ description: "ID del mensaje" })
  id: string;

  @ApiProperty({ description: "ID del usuario remitente" })
  fromUserId: string;

  @ApiProperty({ description: "ID del usuario destinatario" })
  toUserId: string;

  @ApiProperty({ description: "Contenido del mensaje" })
  content: string;

  @ApiProperty({ description: "Indica si el mensaje ha sido entregado al destinatario" })
  isDelivered: boolean;

  @ApiProperty({ description: "Indica si el mensaje ha sido leído" })
  isRead: boolean;

  @ApiProperty({ description: "Fecha de creación del mensaje" })
  createdAt: string;

  @ApiProperty({
    description: "Información del usuario remitente",
    type: UserInfoDto,
    required: false,
  })
  fromUser?: UserInfoDto;

  @ApiProperty({
    description: "Información del usuario destinatario",
    type: UserInfoDto,
    required: false,
  })
  toUser?: UserInfoDto;
}

export class ConversationResponseDto {
  @ApiProperty({
    description: "Información del usuario con quien se conversa",
    type: UserInfoDto,
  })
  user: UserInfoDto;

  @ApiProperty({
    description: "Último mensaje de la conversación",
    type: MessageResponseDto,
  })
  lastMessage: MessageResponseDto;

  @ApiProperty({ description: "Cantidad de mensajes no leídos" })
  unreadCount: number;
}
