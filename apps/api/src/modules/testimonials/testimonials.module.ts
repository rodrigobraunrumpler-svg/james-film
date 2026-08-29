import { Module } from '@nestjs/common';
import { TestimonialsAdminController } from './testimonials.admin.controller.js';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';

@Module({
  controllers: [TestimonialsController, TestimonialsAdminController],
  providers: [TestimonialsService],
})
export class TestimonialsModule {}
