/**
 * Con la FORMA REAL de la pantalla: migas, título, los cuatro campos en línea y
 * la grilla 3:4. Un skeleton que no coincide produce salto de layout, que es
 * peor que no tener ninguno.
 */
export function SkeletonEditor() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="bg-line h-3 w-32 animate-pulse rounded" />
        <div className="bg-active h-6 w-64 animate-pulse rounded" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.25">
            <div className="bg-line h-3 w-20 animate-pulse rounded" />
            <div className="bg-card rounded-control h-[34px] animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(112px,100%),1fr))] gap-3 lg:grid-cols-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-card aspect-3/4 animate-pulse rounded-[7px]" />
        ))}
      </div>
    </div>
  );
}
