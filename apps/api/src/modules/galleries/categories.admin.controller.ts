import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocListarCategorias } from './docs/galleries.docs.js';
import { GalleriesService } from './galleries.service.js';

/**
 * Controller aparte y no un `@Get('categories')` en el de galerías: allí el
 * `@Get(':id')` capturaría la ruta salvo que se declare antes, y ese orden es
 * exactamente el tipo de detalle que alguien rompe reordenando métodos.
 */
@ApiTags('admin/categorías')
@Controller('admin/categories')
export class CategoriesAdminController {
  constructor(private readonly galleries: GalleriesService) {}

  @DocListarCategorias()
  @Get()
  listar() {
    return this.galleries.listarCategorias();
  }
}
