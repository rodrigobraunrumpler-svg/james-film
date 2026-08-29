import { Module } from '@nestjs/common';
import { IconsAdminController } from './icons.admin.controller.js';

@Module({ controllers: [IconsAdminController] })
export class IconsModule {}
