import { Module } from '@nestjs/common';
import { PackagesAdminController } from './packages.admin.controller.js';
import { PackagesController } from './packages.controller.js';
import { PackagesService } from './packages.service.js';

@Module({
  controllers: [PackagesController, PackagesAdminController],
  providers: [PackagesService],
})
export class PackagesModule {}
