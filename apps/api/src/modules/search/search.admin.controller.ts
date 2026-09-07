import { Get, Query } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { SearchQueryDto } from './dto/search.dto.js';
import { DocBuscar } from './docs/search.docs.js';
import { SearchService } from './search.service.js';

@AdminController('admin/search', { tag: 'admin/buscador' })
export class SearchAdminController {
  constructor(private readonly search: SearchService) {}

  @DocBuscar()
  @Get()
  buscar(@Query() dto: SearchQueryDto) {
    return this.search.buscar(dto.q);
  }
}
