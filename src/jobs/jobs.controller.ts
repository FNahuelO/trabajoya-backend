import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { createResponse } from "src/common/mapper/api-response.mapper";

@ApiTags("jobs")
@Controller("api/jobs")
export class JobsController {
  constructor(private service: JobsService) {}

  @Get()
  async list(@Query() q: any) {
    const data = await this.service.search(q);
    return createResponse({
      success: true,
      message: "Trabajos obtenidos correctamente",
      data,
    });
  }

  @Get(":id")
  async one(@Param("id") id: string) {
    const data = await this.service.findById(id);
    return createResponse({
      success: true,
      message: "Trabajo obtenido correctamente",
      data,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: any, @Req() req: any) {
    const data = await this.service.create(dto);
    return createResponse({
      success: true,
      message: "Trabajo creado correctamente",
      data,
    });
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: any, @Req() req: any) {
    const data = await this.service.update(id, req.user?.sub, dto);
    return createResponse({
      success: true,
      message: "Trabajo actualizado correctamente",
      data,
    });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async delete(@Param("id") id: string, @Req() req: any) {
    const data = await this.service.delete(id, req.user?.sub);
    return createResponse({
      success: true,
      message: "Trabajo eliminado correctamente",
      data,
    });
  }
}
