import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { TermsService } from "./terms.service";
import { GetTermsDto } from "./dto/get-terms.dto";
import { AcceptTermsDto } from "./dto/accept-terms.dto";
import { UploadTermsDto } from "./dto/upload-terms.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { Public } from "../common/decorators/public.decorator";
import { createResponse } from "../common/mapper/api-response.mapper";
import { TermsType, UserType } from "@prisma/client";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags("terms")
@Controller("api/terms")
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get("active")
  @Public()
  async getActiveTerms(@Query() dto: GetTermsDto, @Req() req: any) {
    let userType: UserType | undefined;

    // Si el usuario está autenticado, usar su tipo
    if (req.user?.userType) {
      userType = req.user.userType as UserType;
    }

    const terms = await this.termsService.getActiveTerms(userType, dto.type);

    return createResponse({
      success: true,
      message: "Términos obtenidos correctamente",
      data: terms,
    });
  }

  @Get("check-acceptance")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async checkAcceptance(@Req() req: any, @Query("type") type: TermsType) {
    if (!type) {
      throw new BadRequestException("El parámetro 'type' es requerido");
    }

    const userId = req.user?.sub;
    const hasAccepted = await this.termsService.hasAcceptedTerms(userId, type);

    return createResponse({
      success: true,
      message: "Estado de aceptación obtenido correctamente",
      data: {
        hasAccepted,
        userId,
        type,
      },
    });
  }

  @Post("accept")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async acceptTerms(@Req() req: any, @Body() dto: AcceptTermsDto) {
    const userId = req.user?.sub;
    const acceptance = await this.termsService.acceptTerms(
      userId,
      dto.type,
      dto.version
    );

    return createResponse({
      success: true,
      message: "Términos aceptados correctamente",
      data: acceptance,
    });
  }

  @Get("my-acceptances")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyAcceptances(@Req() req: any) {
    const userId = req.user?.sub;
    const acceptances = await this.termsService.getUserAcceptances(userId);

    return createResponse({
      success: true,
      message: "Aceptaciones obtenidas correctamente",
      data: acceptances,
    });
  }

  @Post("upload")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        type: {
          type: "string",
          enum: Object.values(TermsType),
        },
        version: {
          type: "string",
          example: "1.0.0",
        },
        description: {
          type: "string",
        },
      },
    },
  })
  async uploadTerms(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadTermsDto
  ) {
    if (!file) {
      throw new BadRequestException("El archivo es requerido");
    }

    const terms = await this.termsService.uploadTerms(
      file,
      dto.type,
      dto.version,
      dto.description
    );

    return createResponse({
      success: true,
      message: "Términos subidos correctamente",
      data: terms,
    });
  }

  @Get("all")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async getAllTerms(@Query("type") type?: TermsType) {
    const terms = await this.termsService.getAllTerms(type);

    return createResponse({
      success: true,
      message: "Términos obtenidos correctamente",
      data: terms,
    });
  }
}
