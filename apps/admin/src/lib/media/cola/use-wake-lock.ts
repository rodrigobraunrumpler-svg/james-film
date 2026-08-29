'use client';

import { useEffect, useRef } from 'react';

/**
 * Mitigación PARCIAL, y conviene tenerlo claro: solo evita el auto-bloqueo por
 * inactividad. No hace nada ante el botón de encendido, un cambio de app o una
 * llamada. La red de seguridad real es la reconciliación de los PENDING al
 * montar el editor (Task 4, Step 0).
 */
export function useWakeLock(activo: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);
  const activoRef = useRef(activo);
  activoRef.current = activo;

  useEffect(() => {
    let vivo = true;

    const pedir = async (): Promise<void> => {
      if (!vivo || !activoRef.current) return;
      // Pedirlo con la pestaña oculta lanza NotAllowedError.
      if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;

      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (!vivo || !activoRef.current) {
          void sentinel.release();
          return;
        }
        lock.current = sentinel;
        // El UA lo suelta también por batería baja o modo ahorro, y eso NO
        // dispara visibilitychange: hay que escuchar el propio release.
        sentinel.addEventListener('release', () => {
          lock.current = null;
          if (activoRef.current) void pedir();
        });
      } catch {
        // Safari antiguo o permiso denegado: no es un error que James pueda
        // resolver, y la subida sigue funcionando igual.
        lock.current = null;
      }
    };

    const alVolver = (): void => {
      if (document.visibilityState === 'visible' && activoRef.current) void pedir();
    };

    document.addEventListener('visibilitychange', alVolver);
    if (activo) void pedir();

    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      void lock.current?.release();
      lock.current = null;
    };
  }, [activo]);
}

/**
 * `beforeunload` SOLO en escritorio: en Safari de iOS no produce diálogo, en
 * modo standalone tampoco, y no se dispara en una navegación del App Router.
 * En el iPhone la señal es la fila de progreso visible.
 */
export function useAvisarAlSalir(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;

    const alSalir = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [activo]);
}
