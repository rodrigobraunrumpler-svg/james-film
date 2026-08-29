'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { keys } from '@/lib/api/keys';
import { tamano } from '@/lib/format';
import { hayEnCurso } from './motor';
import { conectarCache, useCola } from './store';
import { estaEnCurso } from './tipos';
import { useAvisarAlSalir, useWakeLock } from './use-wake-lock';

/**
 * Vive en el LAYOUT del panel, no en el editor. Atada al editor, tocar
 * «Galerías» en el sidebar liberaría el Wake Lock y borraría toda señal de
 * progreso: James ve `Subiendo 3 de 8` desde cualquier pantalla.
 */
export function BarraSubidas() {
  const qc = useQueryClient();
  useEffect(() => conectarCache(qc), [qc]);

  const resumen = useCola((estado) => {
    const items = Object.values(estado.items);
    const activos = items.filter(estaEnCurso);
    if (activos.length === 0) return null;

    const total = items.reduce((n, i) => n + i.archivo.size, 0);
    const subido = items.reduce(
      (n, i) => n + (i.estado === 'LISTO' ? i.archivo.size : i.bytesSubidos),
      0,
    );
    return {
      hechos: items.filter((i) => i.estado === 'LISTO').length,
      totalItems: items.length,
      subido,
      total,
    };
  });

  const activo = useCola(hayEnCurso);

  // Al volver a la pestaña con subidas vivas, se relee la galería: iOS pudo
  // suspenderla con medios a medio confirmar. El Wake Lock solo evita el
  // auto-bloqueo por inactividad; esto es la red de seguridad.
  useEffect(() => {
    if (!activo) return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        void qc.invalidateQueries({ queryKey: keys.galleries.all });
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [activo, qc]);
  useWakeLock(activo);
  useAvisarAlSalir(activo);

  if (!resumen) return null;

  const porcentaje = resumen.total > 0 ? Math.round((resumen.subido / resumen.total) * 100) : 0;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:left-64"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Subiendo {resumen.hechos + 1} de {resumen.totalItems} · {tamano(resumen.subido)} de{' '}
          {tamano(resumen.total)}
        </p>
        {/* Progreso REAL, nunca indeterminado: en una subida es lo único que
            distingue «va lento» de «se colgó». */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full [transform-origin:left] bg-neutral-900 transition-transform duration-300"
            // scaleX y no width: solo transform y opacity se animan (§6).
            style={{ transform: `scaleX(${porcentaje / 100})` }}
          />
        </div>
        <p className="text-xs text-neutral-500">
          No bloquees la pantalla ni cambies de app mientras se suben.
        </p>
      </div>
    </div>
  );
}
