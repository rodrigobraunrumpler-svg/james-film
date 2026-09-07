import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { AvailabilityDto } from '@james-film/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { DocDisponibilidadPublica } from './docs/availability.docs.js';
import { AvailabilityService } from './availability.service.js';

/**
 * Público y **sin NINGÚN parámetro**, a propósito: ni para ampliar la ventana
 * ni para pedir notas. Un endpoint público que no acepta nada no se puede
 * filtrar mal.
 *
 * `@SkipThrottle()` porque el build de Astro hace decenas de peticiones desde
 * una sola IP en segundos: con el throttler global las tumbaría, y el modo de
 * fallo sería el peor — el build aborta y la web se queda con la versión vieja.
 */
@Public()
@SkipThrottle()
@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @DocDisponibilidadPublica()
  @Get()
  publica(): Promise<AvailabilityDto> {
    return this.availability.publica();
  }
}
