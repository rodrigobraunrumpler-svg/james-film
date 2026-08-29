import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { DocListarCategoriasPublicas } from './docs/categories.docs.js';
import { CategoriesService } from './categories.service.js';

/**
 * `@SkipThrottle`: el build de Astro pide esto junto con galerías, paquetes y
 * testimonios desde una sola IP y en segundos. Con el throttler global las
 * tumbaría, y el modo de fallo es el peor — el build falla y la web se queda
 * en la versión vieja.
 */
@ApiTags('categorías')
@SkipThrottle()
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @DocListarCategoriasPublicas()
  @Get()
  listar() {
    return this.categories.listarPublicas();
  }
}
