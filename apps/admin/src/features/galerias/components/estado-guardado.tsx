import { relativo } from '@/lib/format';
import type { EstadoGuardado } from '../hooks/use-autoguardado';

/**
 * Una línea de texto, ni spinner ni toast: el autoguardado se dispara cada dos
 * segundos y un spinner que aparece y desaparece a ese ritmo es una pantalla que
 * tiembla. `role="status"` para que un lector de pantalla lo anuncie sin robar
 * el foco (`aria-live="polite"` implícito).
 */
export function EstadoGuardado({
  estado,
  guardadoEn,
}: {
  estado: EstadoGuardado;
  guardadoEn: Date | null;
}) {
  const texto =
    estado === 'guardando'
      ? 'Guardando…'
      : estado === 'error'
        ? 'No se pudo guardar. Se reintentará al siguiente cambio.'
        : guardadoEn
          ? `Guardado ${relativo(guardadoEn)}`
          : '';

  return (
    <p
      role="status"
      className={`min-h-5 text-sm ${estado === 'error' ? 'text-red-600' : 'text-neutral-500'}`}
    >
      {texto}
    </p>
  );
}
