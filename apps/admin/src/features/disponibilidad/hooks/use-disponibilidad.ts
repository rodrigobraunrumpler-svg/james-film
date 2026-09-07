'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IsoDate, SetAvailabilityInput } from '@james-film/contracts';
import { keys } from '@/lib/api/keys';
import { disponibilidad } from '../services/disponibilidad';

/**
 * Los días ocupados del mes que se está mirando.
 *
 * Se pide un rango generoso —el mes con sus semanas de relleno— y no el mes
 * exacto: la rejilla enseña días del anterior y del siguiente, y si no vinieran
 * saldrían libres cuando no lo están.
 */
export function useDiasOcupados(from: IsoDate, to: IsoDate) {
  return useQuery({
    queryKey: keys.availability.range(from, to),
    queryFn: ({ signal }) => disponibilidad.listar(from, to, { signal }),
    // El calendario se navega hacia adelante y hacia atrás: sin esto, volver al
    // mes anterior es otra petición para un dato que no ha cambiado.
    staleTime: 60_000,
    /**
     * Cambiar de mes es OTRA clave, así que sin esto la consulta vuelve a
     * `isPending` y el calendario se cae al esqueleto en cada flecha. Volver al
     * esqueleto teniendo datos en pantalla es un retroceso: tenías información
     * y pasas a tener menos. Se conserva el mes anterior y se atenúa mientras
     * llega el nuevo, que es la regla del proyecto para los refetch.
     */
    placeholderData: keepPreviousData,
  });
}

export function useResumenDisponibilidad() {
  return useQuery({
    queryKey: keys.availability.summary(),
    queryFn: ({ signal }) => disponibilidad.resumen({ signal }),
  });
}

/**
 * Marcar y desmarcar.
 *
 * **Sin optimista, y es deliberado.** La regla del proyecto es ser optimista
 * por defecto, salvo cuando el servidor decide algo impredecible: aquí lo hace
 * dos veces —asigna el `groupId` que agrupa la reserva y puede rechazar el
 * pasado con un 422—, así que pintar el día ocupado antes de tiempo enseñaría
 * un estado que la respuesta puede desmentir. Es la misma excepción que el slug
 * con desambiguación.
 *
 * Se invalida TODO el prefijo `availability`: el rango que se está mirando, los
 * meses vecinos que estén en caché y el resumen, que cuenta sábados y avisos
 * derivados de lo que se acaba de tocar.
 */
export function useMarcarDias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetAvailabilityInput) => disponibilidad.marcar(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.availability.all }),
  });
}
