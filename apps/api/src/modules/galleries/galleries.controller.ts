import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { GalleriesService } from './galleries.service.js';

/**
 * Público y read-only. Lo consume Astro en BUILD TIME: hace decenas de
 * peticiones desde una sola IP en segundos, así que el throttler global las
 * tumbaría — y el modo de fallo es el peor: el build falla y la web se queda
 * con la versión vieja sin que nadie sepa por qué.
 */
@Public()
@SkipThrottle()
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly galleries: GalleriesService) {}

  @Get()
  listar(@Query() query: PaginationDto) {
    return this.galleries.listarPublicas(query.page, query.pageSize);
  }

  @Get(':slug')
  porSlug(@Param('slug') slug: string) {
    return this.galleries.buscarPorSlug(slug);
  }
}
