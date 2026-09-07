'use client';

import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { keys } from '@/lib/api/keys';
import { tamano } from '@/lib/format';
import { useEnLinea } from './conexion';
import { hayEnCurso } from './motor';
import { conectarCache, cola, useCola } from './store';
import { estaEnCurso } from './tipos';
import { useAvisarAlSalir, useWakeLock } from './use-wake-lock';

/**
 * ARRIBA del contenido y dentro del flujo, no flotando: un elemento flotante no
 * ocupa sitio y tapaba el botón de Cancelar de la última tarjeta —justo el que
 * hace falta mientras se sube—. Lo encontró el E2E, que no pudo pulsarlo.
 *
 * Y vive en el LAYOUT, no en el editor: atada al editor, tocar «Galerías» en el
 * sidebar liberaría el Wake Lock y borraría toda señal de progreso. Así James
 * ve «Subiendo 3 de 8» desde cualquier pantalla.
 */
export function BarraSubidas() {
  const qc = useQueryClient();
  useEffect(() => conectarCache(qc), [qc]);

  // El selector devuelve el RECORD y el cálculo va FUERA. Devolviendo un objeto
  // derivado, cada lectura es un snapshot distinto para useSyncExternalStore:
  // React lo detecta al confirmar, fuerza otro render, vuelve a diferir… y la
  // pantalla se cae con «Maximum update depth exceeded». Solo pasaba con la
  // barra visible, o sea únicamente durante una subida de verdad.
  const items = Object.values(useCola((e) => e.items));
  const enCurso = items.some(estaEnCurso);
  const resumen = enCurso
    ? {
        hechos: items.filter((i) => i.estado === 'LISTO').length,
        totalItems: items.length,
        subido: items.reduce(
          (n, i) => n + (i.estado === 'LISTO' ? i.archivo.size : i.bytesSubidos),
          0,
        ),
        total: items.reduce((n, i) => n + i.archivo.size, 0),
      }
    : null;

  const activo = useCola(hayEnCurso);

  // Se ancla al empezar el lote para poder estimar lo que falta. Un ref y no
  // estado: no debe provocar render, solo acompañar a los que ya ocurren con
  // cada tick de progreso.
  const inicio = useRef<{ t: number; bytes: number } | null>(null);
  if (!enCurso) inicio.current = null;
  else inicio.current ??= { t: Date.now(), bytes: resumen?.subido ?? 0 };

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
  const enLinea = useEnLinea();
  useWakeLock(activo);
  useAvisarAlSalir(activo);

  if (!resumen) return null;

  const porcentaje = resumen.total > 0 ? Math.round((resumen.subido / resumen.total) * 100) : 0;
  const restante = estimacion(inicio.current, resumen.subido, resumen.total);

  return (
    <div
      role="status"
      className="bg-chrome border-line flex flex-col gap-1.75 border-b px-4 pt-2.25 pb-2.5 lg:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Sin red, «Subiendo 1 de 8» con el tiempo restante congelado es la
            misma mentira que la tesela: no está subiendo nada. Se dice el
            estado real y CUÁNTAS quedan, que es lo que decide si James se mueve
            a buscar cobertura o se espera. */}
        {enLinea ? (
          <p className="min-w-0 truncate">
            Subiendo {resumen.hechos + 1} de {resumen.totalItems} ·{' '}
            {restante ?? `${tamano(resumen.subido)} de ${tamano(resumen.total)}`}
          </p>
        ) : (
          <p className="flex min-w-0 items-center gap-2 truncate">
            <WifiOff className="text-danger size-3.5 shrink-0" aria-hidden strokeWidth={2} />
            <span className="text-bone">Sin conexión.</span>
            <span className="text-ash">
              Quedan {resumen.totalItems - resumen.hechos}. Se reanuda solo al volver.
            </span>
          </p>
        )}
        <button
          type="button"
          // «Cancelar TODO», no «Cancelar»: cada tarjeta tiene el suyo y con el
          // mismo nombre no se distinguen ni para James ni para un lector de
          // pantalla — ni para el E2E, que cuenta los botones «Cancelar».
          onClick={() => {
            for (const i of items) if (estaEnCurso(i)) void cola.cancelar(i.clientUploadId);
          }}
          className="text-ash hover:text-bone shrink-0 text-sm transition-colors duration-150"
        >
          Cancelar todo
        </button>
      </div>

      {/* Progreso REAL, nunca indeterminado: en una subida es lo único que
          distingue «va lento» de «se colgó». */}
      <div
        className="bg-line h-0.75 overflow-hidden rounded-[2px]"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-brass-relleno h-full origin-left transition-transform duration-300 ease-linear"
          // scaleX y no width: solo transform y opacity se animan (§6). Y la
          // curva es LINEAL: una aceleración inventaría un cambio de
          // velocidad que la subida no está teniendo, y la barra es lo
          // único que le dice a James si el 4G sigue vivo.
          style={{ transform: `scaleX(${porcentaje / 100})` }}
        />
      </div>
    </div>
  );
}

/**
 * «quedan ~2 min» a partir de lo que de verdad ha ido subiendo, no de una
 * constante. Devuelve `null` los primeros segundos: una estimación hecha con
 * medio segundo de muestra da minutos inventados, y eso es peor que no dar
 * ninguno — James decidiría si le da tiempo a salir de casa con un número falso.
 */
function estimacion(
  inicio: { t: number; bytes: number } | null,
  subido: number,
  total: number,
): string | null {
  if (!inicio) return null;
  const ms = Date.now() - inicio.t;
  const avance = subido - inicio.bytes;
  if (ms < 4000 || avance <= 0) return null;

  const segundos = Math.round((total - subido) / (avance / ms) / 1000);
  if (segundos <= 0) return null;
  if (segundos < 60) return 'quedan menos de 1 min';
  return `quedan ~${Math.ceil(segundos / 60)} min`;
}
