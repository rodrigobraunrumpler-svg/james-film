import { Module } from '@nestjs/common';
import { CategoriesAdminController } from './categories.admin.controller.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
