import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/** Sin servicio propio: son cinco líneas y un `SELECT 1`. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
