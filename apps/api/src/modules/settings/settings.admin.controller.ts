import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ReorderDto } from '../../common/dto/reorder.dto.js';
import {
  DocActualizarAjustes,
  DocActualizarDiferenciador,
  DocActualizarRed,
  DocBorrarDiferenciador,
  DocBorrarRed,
  DocCrearDiferenciador,
  DocCrearRed,
  DocLeerAjustes,
  DocListarDiferenciadoresAdmin,
  DocListarRedesAdmin,
  DocReordenarDiferenciadores,
  DocReordenarRedes,
} from './docs/settings.docs.js';
import { CreateDifferentiatorDto, UpdateDifferentiatorDto } from './dto/differentiator.dto.js';
import { CreateSocialLinkDto, UpdateSocialLinkDto } from './dto/social-link.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@AdminController('admin', { tag: 'admin/configuración' })
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @DocLeerAjustes(true)
  @Get('settings')
  leer() {
    return this.settings.leer();
  }

  @DocActualizarAjustes()
  @Patch('settings')
  actualizar(@Body() dto: UpdateSettingsDto) {
    return this.settings.actualizar(dto);
  }

  // ----------------------------------------------------- diferenciadores

  @DocListarDiferenciadoresAdmin()
  @Get('differentiators')
  diferenciadores() {
    return this.settings.listarDiferenciadoresAdmin();
  }

  @DocCrearDiferenciador()
  @Post('differentiators')
  crearDiferenciador(@Body() dto: CreateDifferentiatorDto) {
    return this.settings.crearDiferenciador(dto);
  }

  /** ANTES de `:id`, o `:id` captura «reorder». Con test. */
  @DocReordenarDiferenciadores()
  @Patch('differentiators/reorder')
  reordenarDiferenciadores(@Body() dto: ReorderDto) {
    return this.settings.reordenarDiferenciadores(dto.ids);
  }

  @DocActualizarDiferenciador()
  @Patch('differentiators/:id')
  actualizarDiferenciador(@Param('id') id: string, @Body() dto: UpdateDifferentiatorDto) {
    return this.settings.actualizarDiferenciador(id, dto);
  }

  @DocBorrarDiferenciador()
  @HttpCode(204)
  @Delete('differentiators/:id')
  borrarDiferenciador(@Param('id') id: string): Promise<void> {
    return this.settings.borrarDiferenciador(id);
  }

  // ---------------------------------------------------------------- redes

  @DocListarRedesAdmin()
  @Get('social-links')
  redes() {
    return this.settings.listarRedesAdmin();
  }

  @DocCrearRed()
  @Post('social-links')
  crearRed(@Body() dto: CreateSocialLinkDto) {
    return this.settings.crearRed(dto);
  }

  @DocReordenarRedes()
  @Patch('social-links/reorder')
  reordenarRedes(@Body() dto: ReorderDto) {
    return this.settings.reordenarRedes(dto.ids);
  }

  @DocActualizarRed()
  @Patch('social-links/:id')
  actualizarRed(@Param('id') id: string, @Body() dto: UpdateSocialLinkDto) {
    return this.settings.actualizarRed(id, dto);
  }

  @DocBorrarRed()
  @HttpCode(204)
  @Delete('social-links/:id')
  borrarRed(@Param('id') id: string): Promise<void> {
    return this.settings.borrarRed(id);
  }
}
