import { Module } from '@nestjs/common';
import { SettingsAdminController } from './settings.admin.controller.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * Diferenciadores y redes viven aquí y no en pantallas propias: son listas
 * dentro de Configuración (decidido en `CLAUDE.md`, contra §9).
 */
@Module({
  controllers: [SettingsController, SettingsAdminController],
  providers: [SettingsService],
})
export class SettingsModule {}
