import { Body, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ReorderDto } from '../../common/dto/reorder.dto.js';
import {
  DocActualizarGaleria,
  DocBorrarGaleria,
  DocContarGalerias,
  DocCrearGaleria,
  DocGaleriaPorId,
  DocListarGaleriasAdmin,
  DocMarcarPortada,
  DocReordenarMedios,
} from './docs/galleries.docs.js';
import { CreateGalleryDto } from './dto/create-gallery.dto.js';
import { ListGalleriesDto } from './dto/list-galleries.dto.js';
import { UpdateGalleryDto } from './dto/update-gallery.dto.js';
import { GalleriesService } from './galleries.service.js';

@AdminController('admin/galleries', { tag: 'admin/galerías' })
export class GalleriesAdminController {
  constructor(private readonly galleries: GalleriesService) {}

  @DocListarGaleriasAdmin()
  @Get()
  listar(@Query() query: ListGalleriesDto) {
    return this.galleries.listarTodas(query.page, query.pageSize, query.estado, query.q);
  }

  /**
   * ANTES de `@Get(':id')`, y no es estilo: Nest resuelve por orden de
   * declaración, así que abajo `:id` capturaría «counts» y buscaría una galería
   * con ese id. Devolvería 404 y el fallo parecería del cliente.
   */
  @DocContarGalerias()
  @Get('counts')
  contar() {
    return this.galleries.contar();
  }

  @DocGaleriaPorId()
  @Get(':id')
  porId(@Param('id') id: string) {
    return this.galleries.buscarPorId(id);
  }

  @DocCrearGaleria()
  @Post()
  crear(@Body() dto: CreateGalleryDto) {
    return this.galleries.crear(dto);
  }

  @DocActualizarGaleria()
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: UpdateGalleryDto) {
    return this.galleries.actualizar(id, dto);
  }

  @DocBorrarGaleria()
  @HttpCode(204)
  @Delete(':id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.galleries.borrar(id);
  }

  @DocReordenarMedios()
  @Patch(':id/media/reorder')
  reordenar(@Param('id') id: string, @Body() dto: ReorderDto) {
    return this.galleries.reordenarMedios(id, dto.ids);
  }

  @DocMarcarPortada()
  @Patch(':id/media/:mediaId/cover')
  portada(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.galleries.marcarPortada(id, mediaId);
  }
}
