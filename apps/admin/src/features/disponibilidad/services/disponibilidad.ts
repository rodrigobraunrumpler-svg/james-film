import type {
  AvailabilitySummaryDto,
  BusyDayDto,
  IsoDate,
  SetAvailabilityInput,
} from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export const disponibilidad = {
  /** Los días ocupados de un rango, CON su nota privada. Solo el panel. */
  listar: (from: IsoDate, to: IsoDate, opts?: RequestOptions) =>
    api.get<BusyDayDto[]>(`/admin/availability?from=${from}&to=${to}`, opts),

  /** Todo lo que la pantalla enseña alrededor del calendario, de una vez. */
  resumen: (opts?: RequestOptions) =>
    api.get<AvailabilitySummaryDto>('/admin/availability/summary', opts),

  /**
   * Marca o desmarca. UN `PUT` para el toque y para el rango: las fechas que
   * van juntas quedan en el mismo grupo, que es lo que convierte «24 y 25 de
   * octubre» en una boda y no en dos días sueltos.
   */
  marcar: (input: SetAvailabilityInput) => api.put<BusyDayDto[]>('/admin/availability', input),
};
