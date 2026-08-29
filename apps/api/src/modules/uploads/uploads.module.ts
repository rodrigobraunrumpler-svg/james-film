import { Module } from '@nestjs/common';
import { UploadsAdminController } from './uploads.admin.controller.js';
import { UploadsService } from './uploads.service.js';

/** Sin controller público: nadie firma subidas desde la landing. */
@Module({
  controllers: [UploadsAdminController],
  providers: [UploadsService],
})
export class UploadsModule {}
