import { Module } from '@nestjs/common';
import { GalleriesAdminController } from './galleries.admin.controller.js';
import { GalleriesController } from './galleries.controller.js';
import { GalleriesService } from './galleries.service.js';

@Module({
  // Dos controllers, siempre: si se mezclan acabas con guards condicionales y
  // campos que se filtran a la landing sin querer (§5).
  controllers: [GalleriesController, GalleriesAdminController],
  providers: [GalleriesService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
