'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

export type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error';

/**
 * §10: guardar como borrador con debounce de 2 s. "Si la pestaña muere con el
 * título y la descripción escritos, no debe perderlos."
 *
 * Ni spinner ni toast: el guardado se dispara cada dos segundos y un spinner a
 * ese ritmo es una pantalla que tiembla. El estado lo pinta una línea discreta.
 */
export function useAutoguardado<T extends FieldValues>(
  form: UseFormReturn<T>,
  guardar: (datos: T) => Promise<unknown>,
  { retrasoMs = 2000 }: { retrasoMs?: number } = {},
) {
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo');
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const disparar = useDebouncedCallback(async () => {
    // `trigger()` en vez de `formState.isValid`: el formState de RHF es un Proxy
    // que solo actualiza los campos LEÍDOS DURANTE EL RENDER. Leer `isValid`
    // desde un callback devuelve el valor inicial la primera vez, así que el
    // primer cambio no se guardaba nunca. Verificado con un test.
    if (!(await form.trigger())) {
      if (montado.current) setEstado('inactivo');
      return;
    }

    setEstado('guardando');
    try {
      await guardar(form.getValues());
      // Sin esto, desmontar a mitad de guardado deja un setState sobre un
      // componente que ya no existe.
      if (!montado.current) return;
      setEstado('guardado');
      setGuardadoEn(new Date());
    } catch {
      if (montado.current) setEstado('error');
    }
  }, retrasoMs);

  useEffect(() => {
    const sub = form.watch((_valores, { type }) => {
      // Solo los cambios del usuario: `reset()` al cargar los datos también
      // dispara watch, y guardaría lo mismo que se acaba de leer.
      if (type === 'change') void disparar();
    });
    return () => sub.unsubscribe();
  }, [form, disparar]);

  // Al desmontar, lo pendiente se envía: si no, cerrar el editor a los 1.9 s de
  // escribir pierde el cambio.
  useEffect(() => () => void disparar.flush(), [disparar]);

  return { estado, guardadoEn };
}
