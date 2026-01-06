import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { RegisterEmpresaDto } from "./dto/register-empresa.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(private service: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    return createResponse({
      success: true,
      message: "Usuario registrado correctamente",
      data: await this.service.register(dto),
    });
  }

  @Public()
  @Post("register-empresa")
  async registerEmpresa(@Body() dto: RegisterEmpresaDto) {
    return createResponse({
      success: true,
      message: "Empresa registrada correctamente",
      data: await this.service.registerEmpresa(dto),
    });
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return createResponse({
      success: true,
      message: "Usuario logueado correctamente",
      data: await this.service.login(dto),
    });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Req() req: any) {
    return { userId: req.user?.sub ?? null };
  }

  @Public()
  @Post("refresh")
  async refreshToken(@Body() dto: { refreshToken: string }) {
    return createResponse({
      success: true,
      message: "Token actualizado correctamente",
      data: await this.service.refreshToken(dto.refreshToken),
    });
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Req() req: any, @Body() dto?: { refreshToken?: string }) {
    return createResponse({
      success: true,
      message: "Usuario deslogueado correctamente",
      data: await this.service.logout(req.user?.sub, dto?.refreshToken),
    });
  }

  @Public()
  @Post("forgot-password")
  async forgotPassword(@Body() dto: { email: string }) {
    return createResponse({
      success: true,
      message: "Email de recuperación enviado correctamente",
      data: await this.service.forgotPassword(dto.email),
    });
  }

  @Public()
  @Post("reset-password")
  async resetPassword(@Body() dto: { token: string; password: string }) {
    return createResponse({
      success: true,
      message: "Contraseña restablecida correctamente",
      data: await this.service.resetPassword(dto.token, dto.password),
    });
  }

  @Public()
  @Post("verify-email")
  async verifyEmail(@Body() dto: { token: string }) {
    return createResponse({
      success: true,
      message: "Email verificado correctamente",
      data: await this.service.verifyEmail(dto.token),
    });
  }

  @Public()
  @Post("resend-verification")
  async resendVerification(@Body() dto: { email: string }) {
    return createResponse({
      success: true,
      message: "Email de verificación reenviado correctamente",
      data: await this.service.resendVerificationEmail(dto.email),
    });
  }
}
