import { Body, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { DocPresignUpload } from './docs/uploads.docs.js';
import { PresignUploadDto } from './dto/presign-upload.dto.js';
import { UploadsService } from './uploads.service.js';

@AdminController('admin/uploads', { tag: 'admin/subidas' })
export class UploadsAdminController {
  constructor(private readonly uploads: UploadsService) {}

  @DocPresignUpload()
  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.uploads.firmar(dto);
  }
}
