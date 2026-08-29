import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ReorderDto } from '../../common/dto/reorder.dto.js';
import {
  DocActualizarTestimonio,
  DocBorrarTestimonio,
  DocCrearTestimonio,
  DocDestacarTestimonio,
  DocListarTestimoniosAdmin,
  DocReordenarTestimonios,
} from './docs/testimonials.docs.js';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import { TestimonialsService } from './testimonials.service.js';

@AdminController('admin/testimonials', { tag: 'admin/testimonios' })
export class TestimonialsAdminController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @DocListarTestimoniosAdmin()
  @Get()
  listar() {
    return this.testimonials.listarTodos();
  }

  @DocCrearTestimonio()
  @Post()
  crear(@Body() dto: CreateTestimonialDto) {
    return this.testimonials.crear(dto);
  }

  /** ANTES de `@Patch(':id')`: si no, `:id` captura «reorder». Con test. */
  @DocReordenarTestimonios()
  @Patch('reorder')
  reordenar(@Body() dto: ReorderDto) {
    return this.testimonials.reordenar(dto.ids);
  }

  @DocActualizarTestimonio()
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.testimonials.actualizar(id, dto);
  }

  @DocDestacarTestimonio()
  @Patch(':id/feature')
  destacar(@Param('id') id: string) {
    return this.testimonials.destacar(id);
  }

  @DocBorrarTestimonio()
  @HttpCode(204)
  @Delete(':id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.testimonials.borrar(id);
  }
}
