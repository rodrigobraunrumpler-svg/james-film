import { Module } from '@nestjs/common';
import { MediaAdminController } from './media.admin.controller.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [MediaAdminController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
