/**
 * Con la FORMA REAL del contenido, no rectángulos genéricos: un skeleton que no
 * coincide con lo que llega produce salto de layout, que es peor que no tener
 * ninguno. El `aspect-[9/16]` de la portada es el mismo que la tarjeta final.
 */
export function SkeletonLista({ filas = 6 }: { filas?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: filas }, (_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-lg border p-3">
          <div className="aspect-[9/16] w-12 shrink-0 animate-pulse rounded bg-neutral-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="hidden h-3 w-16 animate-pulse rounded bg-neutral-100 sm:block" />
        </li>
      ))}
    </ul>
  );
}
