/**
 * Con la FORMA REAL: el titular, el mes con su rejilla de cinco semanas y las
 * cuatro tarjetas de la derecha, en su sitio y con su alto.
 *
 * Y hace falta MÁS que en otras pantallas, porque aquí el vacío MIENTE: sin él,
 * mientras carga se pintaba «Nada cogido por delante. Todo libre.» — que es una
 * frase, no un hueco, y decía justo lo contrario de lo que puede ser cierto un
 * segundo después. Un estado de carga que se lee como un dato es peor que un
 * rectángulo gris.
 *
 * `animate-pulse` y no un shimmer que recorre: el shimmer repinta en bucle toda
 * la carga para conseguir exactamente lo mismo.
 */
export function SkeletonDisponibilidad() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="bg-active h-7 w-56 animate-pulse rounded" />
      <div className="bg-line h-4 w-full max-w-[52ch] animate-pulse rounded" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="bg-active size-11 animate-pulse rounded-md lg:size-8" />
            <div className="bg-active h-5 w-36 animate-pulse rounded" />
            <div className="bg-active size-11 animate-pulse rounded-md lg:size-8" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="bg-line mx-auto h-2.5 w-2 animate-pulse rounded" />
            ))}
          </div>
          {/* Cinco semanas, que es el mínimo que pinta la rejilla: con seis, al
              llegar los datos de un mes corto la columna de al lado subiría. */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="bg-active h-11 animate-pulse rounded-md lg:h-10" />
            ))}
          </div>
          <div className="bg-line h-3 w-3/4 animate-pulse rounded" />
        </section>

        <div className="flex flex-col gap-4">
          {[3, 2, 3].map((filas, i) => (
            <section
              key={i}
              className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-3.5"
            >
              <div className="bg-line h-3 w-32 animate-pulse rounded" />
              {Array.from({ length: filas }, (_, j) => (
                <div key={j} className="flex flex-col gap-1">
                  <div className="bg-active h-3.5 w-4/5 animate-pulse rounded" />
                  <div className="bg-line h-3 w-2/5 animate-pulse rounded" />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
