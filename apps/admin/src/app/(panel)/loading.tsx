/**
 * Se ve mientras el servidor resuelve la ruta, ANTES de que corra ningún
 * cliente. Es genérico a propósito: cada pantalla ya trae su propio skeleton
 * con la forma real de su contenido, y este solo cubre el hueco entre pulsar el
 * enlace y montar el componente.
 */
export default function Cargando() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="bg-active h-5 w-40 animate-pulse rounded" />
      <div className="rounded-control bg-card h-8 w-32 animate-pulse" />
      <div className="grid gap-4.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-card bg-card aspect-16/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
