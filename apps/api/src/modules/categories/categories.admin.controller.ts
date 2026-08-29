import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ReorderDto } from '../../common/dto/reorder.dto.js';
import {
  DocActualizarCategoria,
  DocBorrarCategoria,
  DocCrearCategoria,
  DocListarCategoriasAdmin,
  DocReordenarCategorias,
} from './docs/categories.docs.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CategoriesService } from './categories.service.js';

@AdminController('admin/categories', { tag: 'admin/categorías' })
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @DocListarCategoriasAdmin()
  @Get()
  listar() {
    return this.categories.listarTodas();
  }

  @DocCrearCategoria()
  @Post()
  crear(@Body() dto: CreateCategoryDto) {
    return this.categories.crear(dto);
  }

  /**
   * ANTES que `@Patch(':id')`, y no es cosmético: Nest resuelve por orden de
   * declaración, así que si `:id` fuera primero capturaría «reorder» y el
   * síntoma sería un 404 con aspecto de «ese id no existe». Hay un test que
   * pide esta ruta exacta para que reordenar el fichero no lo rompa en silencio.
   */
  @DocReordenarCategorias()
  @Patch('reorder')
  reordenar(@Body() dto: ReorderDto) {
    return this.categories.reordenar(dto.ids);
  }

  @DocActualizarCategoria()
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.actualizar(id, dto);
  }

  @DocBorrarCategoria()
  @HttpCode(204)
  @Delete(':id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.categories.borrar(id);
  }
}
