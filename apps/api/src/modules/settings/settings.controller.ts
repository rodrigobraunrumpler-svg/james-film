import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  DocLeerAjustes,
  DocListarDiferenciadores,
  DocListarRedes,
} from './docs/settings.docs.js';
import { SettingsService } from './settings.service.js';

@ApiTags('configuración')
@SkipThrottle()
@Public()
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @DocLeerAjustes()
  @Get('settings')
  leer() {
    return this.settings.leer();
  }

  @DocListarDiferenciadores()
  @Get('differentiators')
  diferenciadores() {
    return this.settings.listarDiferenciadores(true);
  }

  @DocListarRedes()
  @Get('social-links')
  redes() {
    return this.settings.listarRedes(true);
  }
}
