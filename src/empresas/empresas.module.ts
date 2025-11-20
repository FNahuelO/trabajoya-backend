import { Module } from '@nestjs/common'
import { EmpresasService } from './empresas.service'
import { EmpresasController } from './empresas.controller'
import { ContentModerationService } from '../common/services/content-moderation.service'
@Module({ controllers: [EmpresasController], providers: [EmpresasService, ContentModerationService] })
export class EmpresasModule {}
