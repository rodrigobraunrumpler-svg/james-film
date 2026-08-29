'use client';

import { useEffect, useState } from 'react';

/**
 * Cuenta atrás en segundos. Devuelve 0 cuando termina.
 *
 * Se recalcula contra un instante final y no restando 1 en cada tick: si la
 * pestaña se va a segundo plano, el navegador estrangula los timers y un
 * contador que resta se queda clavado donde lo dejaste. Contra un instante
 * final, volver a la pestaña muestra el valor correcto.
 */
export function useCuentaAtras(segundos: number | undefined): number {
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    if (!segundos || segundos <= 0) {
      setRestante(0);
      return;
    }
    const fin = Date.now() + segundos * 1000;
    const calcular = (): number => Math.max(0, Math.ceil((fin - Date.now()) / 1000));

    setRestante(calcular());
    const id = setInterval(() => {
      const queda = calcular();
      setRestante(queda);
      if (queda === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [segundos]);

  return restante;
}
