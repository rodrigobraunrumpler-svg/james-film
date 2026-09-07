import { Get } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DocPanel } from './docs/dashboard.docs.js';

@AdminController('admin/dashboard', { tag: 'admin/panel' })
export class DashboardAdminController {
  constructor(private readonly dashboard: DashboardService) {}

  @DocPanel()
  @Get()
  resumen() {
    return this.dashboard.resumen();
  }
}
