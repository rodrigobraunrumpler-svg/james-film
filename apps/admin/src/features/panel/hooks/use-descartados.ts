'use client';

import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'jamesfilm:avisos-descartados';

/**
 * Qué avisos ha descartado James. En `localStorage` y sin tabla: es la decisión
 * de §2 del proyecto, y el dato solo importa en el navegador donde se descartó.
 *
 * Se lee DESPUÉS de montar, no durante el render: en el servidor no existe
 * `localStorage`, y devolver un conjunto vacío allí y uno lleno aquí es un
 * error de hidratación —React descarta el árbol entero y la pantalla parpadea.
 */
export function useDescartados() {
  const [descartados, setDescartados] = useState<Set<string>>(() => new Set());
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setDescartados(leer());
    setListo(true);
  }, []);

  const descartar = useCallback((id: string) => {
    setDescartados((previo) => {
      const siguiente = new Set(previo).add(id);
      guardar(siguiente);
      return siguiente;
    });
  }, []);

  return { descartados, descartar, listo };
}

function leer(): Set<string> {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return new Set();
    const valor: unknown = JSON.parse(crudo);
    // Un `localStorage` manipulado a mano no puede tumbar el panel entero.
    return Array.isArray(valor) ? new Set(valor.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function guardar(ids: Set<string>): void {
  try {
    // Solo los 50 últimos: la lista crecería sin techo con cada subida fallida,
    // y un `localStorage` lleno lanza en el próximo `setItem`.
    window.localStorage.setItem(CLAVE, JSON.stringify([...ids].slice(-50)));
  } catch {
    // Modo privado de Safari o cuota llena: se pierde el descarte, no la pantalla.
  }
}
