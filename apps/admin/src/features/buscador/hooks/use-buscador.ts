'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { keys } from '@/lib/api/keys';
import { buscador } from '../services/buscador';

/** El mínimo que acepta la API: con uno, «a» casa con casi todo. */
const MINIMO = 2;

export function useBusqueda(termino: string) {
  // 200ms: por debajo son cuatro peticiones por palabra, y por encima se nota
  // el retraso al escribir en la caja.
  const [retrasado] = useDebounce(termino.trim(), 200);
  const activa = retrasado.length >= MINIMO;

  const query = useQuery({
    queryKey: keys.search.query(retrasado),
    queryFn: ({ signal }) => buscador.buscar(retrasado, { signal }),
    enabled: activa,
    // Sin esto, cada tecla vacía la lista y la caja parpadea entre resultados.
    placeholderData: (previo) => previo,
    staleTime: 60_000,
  });

  return {
    resultados: activa ? (query.data?.data ?? []) : [],
    cargando: activa && query.isFetching,
    corta: termino.trim().length > 0 && !activa,
  };
}

/**
 * ⌘K en Mac, Ctrl+K en Windows. Se escucha en `keydown` con `preventDefault`
 * porque en Chrome ⌘K es «buscar en la web» desde la barra de direcciones y
 * sin el `preventDefault` se abren las dos cosas.
 */
export function useAtajoBuscador(abrir: () => void): void {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      // `e.key` NO siempre es una cadena: el autorrelleno del navegador, el
      // teclado predictivo de iOS y algunas extensiones despachan eventos de
      // teclado sin `key`, y ahí `.toLowerCase()` revienta la página entera
      // desde un listener global. El tipo de TypeScript dice `string`; el
      // navegador no lo garantiza.
      if (typeof e.key !== 'string') return;
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      abrir();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abrir]);
}
