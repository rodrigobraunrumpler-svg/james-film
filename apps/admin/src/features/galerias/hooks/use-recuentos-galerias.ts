'use client';

import { useQuery } from '@tanstack/react-query';
import type { GalleryCountsDto } from '@james-film/contracts';
import { keys } from '@/lib/api/keys';
import { useMontado } from '@/lib/use-montado';
import { galerias } from '../services/galerias';

/**
 * Los números de las pestañas. Petición aparte de la lista a propósito: si
 * viajaran en la respuesta filtrada, «Borradores 3» valdría 3 estando en
 * Borradores y 0 estando en Publicadas — el contador diría lo contrario de
 * lo que cuenta.
 *
 * **Devuelve `undefined` hasta haber MONTADO**, y eso arregla un error de
 * hidratación real: el servidor no puede saber este número, así que su HTML
 * sale sin el `<span>` del recuento. Si el dato ya estaba cuando React hidrata
 * esta parte del árbol, el navegador pinta un nodo que en el HTML no estaba y
 * **React descarta el árbol entero**.
 *
 * ⚠ Con `enabled: montado` NO basta, y fue el primer intento: `enabled` corta
 * la PETICIÓN, no la lectura — `useQuery` sigue devolviendo lo que haya en
 * caché. Y lo hay: el sidebar monta antes que la página y pide **la misma
 * clave**, así que si su respuesta llega antes del primer render de la
 * pestaña, ese render ya ve el número. El `enabled` se queda porque sigue
 * siendo correcto —no pedir antes de tiempo— pero lo que cierra el fallo es
 * cortar el valor.
 *
 * Se corta AQUÍ y no en la pantalla: si lo sostiene quien pinta, el siguiente
 * consumidor se olvidará. Es la misma regla que el botón «Quitar» de
 * `CampoImagen`.
 */
export function useRecuentosGalerias(): GalleryCountsDto | undefined {
  const montado = useMontado();

  const { data } = useQuery({
    queryKey: keys.galleries.counts(),
    queryFn: ({ signal }) => galerias.contar({ signal }),
    enabled: montado,
  });

  return montado ? data?.data : undefined;
}
