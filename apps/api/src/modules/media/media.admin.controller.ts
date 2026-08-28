import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { PresignDto } from './dto/presign.dto.js';
import { MediaService } from './media.service.js';

@Controller('admin')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  /** N archivos, UN roundtrip: ocho reels no deben ser ocho peticiones (§10). */
  @Post('galleries/:id/media/presign')
  presign(@Param('id') galleryId: string, @Body() dto: PresignDto) {
    return this.media.presign(galleryId, dto.items);
  }

  @HttpCode(200)
  @Post('media/:id/confirm')
  confirmar(@Param('id') id: string) {
    return this.media.confirmar(id);
  }

  @HttpCode(204)
  @Delete('media/:id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.media.borrar(id);
  }
}
