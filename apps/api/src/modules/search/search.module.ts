import { Module } from '@nestjs/common';
import { SearchAdminController } from './search.admin.controller.js';
import { SearchService } from './search.service.js';

@Module({
  controllers: [SearchAdminController],
  providers: [SearchService],
})
export class SearchModule {}
