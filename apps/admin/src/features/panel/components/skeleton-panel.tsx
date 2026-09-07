/**
 * Con la FORMA real de la pantalla, no un rectángulo genérico: así lo que
 * aparece encaja donde ya estabas mirando en vez de empujarlo todo.
 *
 * Sin shimmer recorriendo: repinta en bucle y un `opacity` pulsante hace lo
 * mismo por nada. Es donde el iPhone de James lo nota.
 */
export function SkeletonPanel() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="bg-card h-7 w-64 max-w-full rounded" />
      <div className="bg-card mt-2 h-4 w-48 max-w-full rounded" />

      <div className="border-line rounded-card mt-5 overflow-hidden border">
        <div className="border-line bg-card h-[42px] border-b" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-line bg-card h-[62px] border-b last:border-b-0" />
        ))}
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="bg-card border-line rounded-card h-[280px] border" />
        <div className="flex flex-col gap-3.5">
          <div className="bg-card border-line rounded-card h-[110px] border" />
          <div className="bg-card border-line rounded-card h-[160px] border" />
        </div>
      </div>
    </div>
  );
}
