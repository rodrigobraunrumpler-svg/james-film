'use client';

import { useQuery } from '@tanstack/react-query';
import type { StorageUsageDto } from '@james-film/contracts';
import { api } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';

/**
 * En `lib` y no en una feature: lo consume el sidebar, que es compartido, y
 * ninguna feature puede importar de otra.
 */
export function useUsoAlmacenamiento() {
  return useQuery({
    queryKey: keys.storage.usage,
    queryFn: ({ signal }) => api.get<StorageUsageDto>('/admin/storage', { signal }),
    // El dato cambia cuando James sube, no cuando navega: refrescarlo en cada
    // pantalla sería una petición por clic para mover una barra dos píxeles.
    staleTime: 5 * 60_000,
  });
}

/**
 * §2: un evento curado ≈230 MB. Es una estimación para que «3.2 / 10 GB» diga
 * algo —«quedan unos 29 eventos» se entiende, «6.8 GB libres» hay que traducirlo—
 * y por eso la frase lleva «unos».
 */
const BYTES_POR_EVENTO = 230 * 1024 ** 2;

export const eventosQueCaben = (usedBytes: number, quotaBytes: number): number =>
  Math.max(0, Math.floor((quotaBytes - usedBytes) / BYTES_POR_EVENTO));
