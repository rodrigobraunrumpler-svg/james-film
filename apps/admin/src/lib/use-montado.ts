'use client';

import { useEffect, useState } from 'react';

/**
 * Si el navegador ya tomó el mando.
 *
 * Existe por una regla que este proyecto ya paga en tres sitios —el saludo por
 * hora, los avisos descartados, el «⌘K» contra «Ctrl K»—: **el primer render
 * del navegador tiene que pintar EXACTAMENTE el HTML que mandó el servidor.**
 * Lo que el servidor no puede saber no se pinta hasta después de montar; si no,
 * React lo lee como error de hidratación y **descarta el árbol entero**.
 *
 * Es un `useState` + `useEffect` y no `useSyncExternalStore`: no hay ninguna
 * fuente externa que consultar, solo el hecho de haber montado.
 */
export function useMontado(): boolean {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado;
}
