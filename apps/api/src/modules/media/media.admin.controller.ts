import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import {
  DocActualizarMedia,
  DocBorrarMedia,
  DocConfirmar,
  DocPresign,
  DocRetirarMedia,
  DocUsoAlmacenamiento,
} from './docs/media.docs.js';
import { PresignDto } from './dto/presign.dto.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { MediaService } from './media.service.js';

@AdminController('admin', { tag: 'admin/media' })
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  /** Alimenta el medidor del sidebar. Sin `:id`, así que no hay choque de rutas. */
  @DocUsoAlmacenamiento()
  @Get('storage')
  uso() {
    return this.media.usoDeAlmacenamiento();
  }

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

  @DocActualizarMedia()
  @Patch('media/:id')
  actualizar(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.media.actualizar(id, dto);
  }

  @DocBorrarMedia()
  @HttpCode(204)
  @Delete('media/:id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.media.borrar(id);
  }

  /**
   * Ruta propia y no un parámetro de `DELETE`: son dos intenciones distintas y
   * una de ellas no tiene vuelta atrás. Un `?definitivo=true` se pone por
   * error; una ruta con este nombre, no.
   */
  @DocRetirarMedia()
  @HttpCode(204)
  @Post('media/:id/retirar')
  retirar(@Param('id') id: string): Promise<void> {
    return this.media.retirarPorSolicitud(id);
  }
}
