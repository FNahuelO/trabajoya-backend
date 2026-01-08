import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
} from "@nestjs/common";
import { UploadService, PresignUploadDto, CompleteUploadDto } from "./upload.service";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("upload")
@Controller("api/uploads")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private service: UploadService) {}

  @Post("presign")
  @ApiOperation({ summary: "Genera una presigned URL para subir un archivo a S3" })
  @ApiResponse({
    status: 200,
    description: "Presigned URL generada correctamente",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        data: {
          type: "object",
          properties: {
            uploadUrl: { type: "string" },
            key: { type: "string" },
          },
        },
      },
    },
  })
  async presignUpload(
    @Req() req: any,
    @Body() dto: PresignUploadDto
  ) {
    const result = await this.service.presignUpload(req.user?.sub, dto);
    return {
      success: true,
      message: "Presigned URL generada correctamente",
      data: result,
    };
  }

  @Post("complete")
  @ApiOperation({ summary: "Completa el proceso de upload verificando el archivo en S3" })
  @ApiResponse({
    status: 200,
    description: "Upload completado correctamente",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        data: {
          type: "object",
          properties: {
            mediaAssetId: { type: "string" },
            key: { type: "string" },
          },
        },
      },
    },
  })
  async completeUpload(
    @Req() req: any,
    @Body() dto: CompleteUploadDto
  ) {
    const result = await this.service.completeUpload(req.user?.sub, dto);
    return createResponse({
      success: true,
      message: result.extractedData
        ? "Upload completado correctamente. Datos del CV extraídos."
        : "Upload completado correctamente",
      data: result,
    });
  }

  /**
   * Parsear CV manualmente desde un archivo ya subido
   */
  @Post("parse-cv/:key")
  @ApiOperation({ summary: "Parsear CV manualmente desde un archivo subido" })
  @ApiResponse({
    status: 200,
    description: "CV parseado correctamente",
  })
  async parseCV(
    @Req() req: any,
    @Param("key") key: string
  ) {
    const result = await this.service.parseCVFromKey(req.user?.sub, key);
    return createResponse({
      success: true,
      message: "CV parseado correctamente",
      data: result,
    });
  }
}