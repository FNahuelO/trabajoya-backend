import {
  Controller,
  Get,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "../common/mapper/api-response.mapper";

@ApiTags("users")
@Controller("api/users")
export class UsersController {
  constructor(private service: UsersService) {}

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Delete("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Eliminar cuenta de usuario" })
  @ApiResponse({
    status: 200,
    description: "Cuenta eliminada correctamente",
  })
  @ApiResponse({
    status: 404,
    description: "Usuario no encontrado",
  })
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Req() req: any) {
    await this.service.deleteUserAccount(req.user?.sub);
    return createResponse({
      success: true,
      message: "Cuenta eliminada correctamente",
      data: null,
    });
  }
}
