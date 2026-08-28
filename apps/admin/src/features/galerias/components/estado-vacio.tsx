import { Images } from 'lucide-react';

/**
 * §9: "la primera vez que entre no habrá nada. En vez de una tabla vacía, 'Aún no
 * tienes galerías → Crear la primera'. Es el momento en que decide si la
 * herramienta le sirve."
 */
export function EstadoVacio({ alCrear }: { alCrear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
      <Images className="size-10 text-neutral-400" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Aún no tienes galerías</p>
        <p className="text-sm text-neutral-600">
          Una galería es un evento: los reels de una boda, unos XV, un cumpleaños.
        </p>
      </div>
      <button
        type="button"
        onClick={alCrear}
        className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
      >
        Crear la primera
      </button>
    </div>
  );
}
