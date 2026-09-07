import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { TrackClickDto } from './dto/track-click.dto.js';
import { DocTrackClic } from './docs/tracking.docs.js';
import { TrackingService } from './tracking.service.js';

/**
 * Público a propósito: lo llama el navegador de quien visita la landing, que no
 * tiene sesión. Sigue bajo el throttler global (§2: la API es accesible desde
 * internet, y este es justo el endpoint que alguien podría querer inflar).
 */
@Public()
@ApiTags('tracking')
@Controller('track')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @DocTrackClic()
  @HttpCode(204)
  @Post('whatsapp')
  clic(@Body() dto: TrackClickDto): Promise<void> {
    return this.tracking.registrar(dto.packageId, dto.source, dto.requestedDate);
  }
}
