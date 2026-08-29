import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { DocListarTestimoniosPublicos } from './docs/testimonials.docs.js';
import { TestimonialsService } from './testimonials.service.js';

@ApiTags('testimonios')
@SkipThrottle()
@Public()
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  /**
   * `galleryId` solo ACOTA; no puede ampliar lo que se ve. El filtro de
   * consentimiento se compone en el servicio y no hay parámetro que lo quite.
   */
  @DocListarTestimoniosPublicos()
  @Get()
  listar(@Query('galleryId') galleryId?: string) {
    return this.testimonials.listarPublicos(galleryId);
  }
}
