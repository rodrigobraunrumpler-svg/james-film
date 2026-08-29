import type { LucideIcon } from 'lucide-react';
import { Boton } from './boton';

/**
 * §9: «la primera vez que entre no habrá nada. En vez de una tabla vacía, "Aún
 * no tienes galerías → Crear la primera". **Es el momento en que decide si la
 * herramienta le sirve**».
 *
 * Por eso lleva SIEMPRE una acción: un estado vacío sin salida es una pared.
 * La explicación dice qué es la cosa, no «no hay resultados» — James no tiene a
 * quién preguntar qué es una «categoría» en este contexto.
 */
export function EstadoVacio({
  Icono,
  titulo,
  explicacion,
  accion,
  onAccion,
}: {
  Icono: LucideIcon;
  titulo: string;
  explicacion: string;
  accion: string;
  onAccion: () => void;
}) {
  return (
    <div className="rounded-card border-line-strong flex flex-col items-center gap-4 border border-dashed px-6 py-14 text-center">
      <Icono className="text-muted size-8" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">{titulo}</p>
        <p className="text-ash max-w-md text-sm">{explicacion}</p>
      </div>
      <Boton variante="principal" onClick={onAccion}>
        {accion}
      </Boton>
    </div>
  );
}
