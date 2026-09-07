import { Module } from '@nestjs/common';
import { AvailabilityAdminController } from './availability.admin.controller.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  controllers: [AvailabilityController, AvailabilityAdminController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
