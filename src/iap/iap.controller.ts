import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  UseGuards,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { IapService } from './iap.service';
import { VerifyAppleDto } from './dto/verify-apple.dto';
import { VerifyGoogleDto } from './dto/verify-google.dto';
import { RestoreDto } from './dto/restore.dto';
import { createResponse } from '../common/mapper/api-response.mapper';

@ApiTags('iap')
@Controller('api/iap')
export class IapController {
  constructor(private readonly iapService: IapService) {}

  @Post('apple/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar compra de Apple IAP' })
  async verifyApple(@Req() req: any, @Body() dto: VerifyAppleDto) {
    const result = await this.iapService.verifyApplePurchase(
      req.user?.sub,
      dto,
    );
    return createResponse({
      success: true,
      message: 'Compra verificada correctamente',
      data: result,
    });
  }

  @Post('google/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar compra de Google Play Billing' })
  async verifyGoogle(@Req() req: any, @Body() dto: VerifyGoogleDto) {
    const result = await this.iapService.verifyGooglePurchase(
      req.user?.sub,
      dto,
    );
    return createResponse({
      success: true,
      message: 'Compra verificada correctamente',
      data: result,
    });
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restaurar compras (iOS) o sincronizar (Android)' })
  async restore(@Req() req: any, @Body() dto: RestoreDto) {
    const result = await this.iapService.restorePurchases(
      req.user?.sub,
      dto,
    );
    return createResponse({
      success: true,
      message: 'Compras restauradas correctamente',
      data: result,
    });
  }

  @Get('products')
  @ApiOperation({ summary: 'Obtener productos IAP por plataforma (público)' })
  async getProducts(@Query('platform') platform: 'IOS' | 'ANDROID') {
    if (!platform || !['IOS', 'ANDROID'].includes(platform)) {
      throw new Error('Platform debe ser IOS o ANDROID');
    }
    const products = await this.iapService.getIapProducts(platform);
    return createResponse({
      success: true,
      message: 'Productos obtenidos correctamente',
      data: products,
    });
  }

  // Admin endpoints
  @Get('admin/iap-products')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar productos IAP (Admin)' })
  async listIapProducts(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 20;
    const planKey = query.planKey;
    const platform = query.platform;

    const data = await this.iapService.listIapProductsAdmin(
      page,
      pageSize,
      planKey,
      platform,
    );
    return createResponse({
      success: true,
      message: 'Productos IAP obtenidos correctamente',
      data,
    });
  }

  @Get('admin/iap-products/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener producto IAP por ID (Admin)' })
  async getIapProductById(@Param('id') id: string) {
    const product = await this.iapService.getIapProductById(id);
    return createResponse({
      success: true,
      message: 'Producto IAP obtenido correctamente',
      data: product,
    });
  }

  @Post('admin/iap-products')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear producto IAP (Admin)' })
  async createIapProduct(@Body() dto: any) {
    const product = await this.iapService.createIapProduct(dto);
    return createResponse({
      success: true,
      message: 'Producto IAP creado correctamente',
      data: product,
    });
  }

  @Patch('admin/iap-products/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar producto IAP (Admin)' })
  async updateIapProduct(@Param('id') id: string, @Body() dto: any) {
    const product = await this.iapService.updateIapProduct(id, dto);
    return createResponse({
      success: true,
      message: 'Producto IAP actualizado correctamente',
      data: product,
    });
  }

  @Delete('admin/iap-products/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar producto IAP (Admin)' })
  async deleteIapProduct(@Param('id') id: string) {
    await this.iapService.deleteIapProduct(id);
    return createResponse({
      success: true,
      message: 'Producto IAP eliminado correctamente',
    });
  }
}

