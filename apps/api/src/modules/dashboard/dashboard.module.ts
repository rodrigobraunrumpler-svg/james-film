import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { DashboardAdminController } from './dashboard.admin.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  // El aviso de «grabado y sin publicar» y los sábados libres salen del mismo
  // cálculo que la pantalla de Disponibilidad. Se importa el módulo en vez de
  // copiar la consulta: el cruce reserva↔galería tiene una sutileza —la galería
  // del primer día cubre la boda entera— que escrita dos veces se desincroniza.
  imports: [AvailabilityModule],
  controllers: [DashboardAdminController],
  providers: [DashboardService],
})
export class DashboardModule {}
