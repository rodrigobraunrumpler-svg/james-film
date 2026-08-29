/**
 * Con la FORMA REAL del contenido, no rectángulos genéricos: un skeleton que no
 * coincide con lo que llega produce salto de layout, que es peor que no tener
 * ninguno. El `aspect-16/10` de la portada es el mismo que la tarjeta final.
 *
 * `animate-pulse` y no un shimmer que recorre: el shimmer repinta en bucle
 * durante toda la carga para conseguir exactamente lo mismo.
 */
export function SkeletonLista({ tarjetas = 6 }: { tarjetas?: number }) {
  return (
    <ul className="grid gap-4.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-hidden>
      {Array.from({ length: tarjetas }, (_, i) => (
        <li key={i} className="rounded-card border-line bg-card overflow-hidden border">
          <div className="bg-well aspect-16/10 animate-pulse" />
          <div className="flex flex-col gap-2 p-3">
            <div className="bg-active h-3.5 w-3/5 animate-pulse rounded" />
            <div className="bg-line h-3 w-2/5 animate-pulse rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
