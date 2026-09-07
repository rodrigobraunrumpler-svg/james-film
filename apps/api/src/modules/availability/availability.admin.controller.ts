import { Body, Get, Put, Query, UnprocessableEntityException } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { AvailabilitySummaryDto, BusyDayDto } from '@james-film/contracts';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { AvailabilityService } from './availability.service.js';
import { DocListarDias, DocMarcarDias, DocResumen } from './docs/availability.docs.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { hoyEnLima } from './fechas.js';

@AdminController('admin/availability', { tag: 'availability (admin)' })
export class AvailabilityAdminController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * ANTES que `@Get()`: Nest resuelve por orden de declaración. Si `summary`
   * cayera debajo de una ruta con parámetro, la capturaría ella y devolvería un
   * error que parece culpa del cliente. Es la misma regla que `counts` en
   * galerías.
   */
  @DocResumen()
  @Get('summary')
  resumen(): Promise<AvailabilitySummaryDto> {
    return this.availability.resumen();
  }

  @DocListarDias()
  @Get()
  @ApiQuery({ name: 'from', example: '2026-09-01' })
  @ApiQuery({ name: 'to', example: '2026-09-30' })
  listar(@Query('from') from: string, @Query('to') to: string): Promise<BusyDayDto[]> {
    return this.availability.listar(from, to);
  }

  @DocMarcarDias()
  @Put()
  marcar(@Body() dto: SetAvailabilityDto): Promise<BusyDayDto[]> {
    /**
     * Solo se rechaza MARCAR en pasado, nunca DESMARCAR. La regla ingenua
     * —«fechas pasadas → 422»— tiene dos trampas:
     *
     *  1. Un día mal marcado en el pasado no se podría quitar jamás, y
     *     equivocarse al arrastrar un rango es justo lo que va a pasar.
     *  2. Comparar contra `new Date()` rechaza HOY durante media jornada: a las
     *     20:00 de Ayacucho el servidor en UTC ya está en el día siguiente, y
     *     el día de hoy pasaría a ser pasado.
     */
    if (dto.busy) {
      const hoy = hoyEnLima();
      // En `YYYY-MM-DD` el orden alfabético ES el cronológico: no hace falta
      // convertir a Date para comparar, y así no hay zona que equivocar.
      const pasadas = dto.dates.filter((d) => d < hoy);
      if (pasadas.length > 0) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_FAILED',
          message: 'No se puede marcar como ocupado un día que ya pasó',
          details: pasadas.map((d) => ({
            field: 'dates',
            code: 'PAST_DATE',
            message: `${d} ya pasó`,
          })),
        });
      }
    }
    return this.availability.marcar(dto);
  }
}
