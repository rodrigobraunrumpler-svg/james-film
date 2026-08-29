import { Body, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { DocBorrarMedia, DocConfirmar, DocPresign } from './docs/media.docs.js';
import { PresignDto } from './dto/presign.dto.js';
import { MediaService } from './media.service.js';

@AdminController('admin', { tag: 'admin/media' })
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  /** N archivos, UN roundtrip: ocho reels no deben ser ocho peticiones (§10). */
  @DocPresign()
  @Post('galleries/:id/media/presign')
  presign(@Param('id') galleryId: string, @Body() dto: PresignDto) {
    return this.media.presign(galleryId, dto.items);
  }

  @DocConfirmar()
  @HttpCode(200)
  @Post('media/:id/confirm')
  confirmar(@Param('id') id: string) {
    return this.media.confirmar(id);
  }

  @DocBorrarMedia()
  @HttpCode(204)
  @Delete('media/:id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.media.borrar(id);
  }
}
