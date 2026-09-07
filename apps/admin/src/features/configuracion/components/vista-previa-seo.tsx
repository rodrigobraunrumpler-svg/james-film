'use client';

import { ocultarSiFalla } from '@/lib/imagen';

/**
 * Los dos sitios donde acaba el SEO, y son los dos únicos que importan: el
 * resultado de Google y la tarjeta que se pinta al pegar el enlace en WhatsApp
 * —que es como James comparte su trabajo veinte veces al día—.
 *
 * Se pintan con SUS colores, no con la paleta del admin: dentro del marco ya
 * no estamos en el panel, y una tarjeta de Google en gris y latón no se
 * reconocería como lo que va a ver el cliente. Mismo criterio que el verde de
 * WhatsApp en la previa del hero.
 */
export function VistaPreviaSeo({
  titulo,
  descripcion,
  imagenUrl,
  dominio,
}: {
  titulo: string;
  descripcion: string;
  imagenUrl: string | null;
  dominio: string;
}) {
  const t = titulo || 'James Film · Reels y aftermovies en Ayacucho';
  const d = descripcion || 'Escribe una descripción para que Google tenga qué enseñar.';

  return (
    <aside className="flex flex-col gap-4" aria-label="Vista previa del SEO">
      <div>
        <p className="text-muted mb-2 text-xs tracking-[0.1em] uppercase">En Google</p>
        <div className="rounded-card bg-white p-3.5 font-[Arial,sans-serif]">
          <p className="truncate text-[12px] leading-tight text-[#4d5156]">{dominio}</p>
          {/* El azul y los tamaños son los de Google: reconocerlo es el punto. */}
          <p className="mt-0.5 line-clamp-2 text-[18px] leading-snug text-[#1a0dab]">{t}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#4d5156]">{d}</p>
        </div>
        <Medida valor={titulo.length} techo={60} que="El título" />
      </div>

      <div>
        <p className="text-muted mb-2 text-xs tracking-[0.1em] uppercase">Al pegarlo en WhatsApp</p>
        {/* La burbuja verde de WhatsApp, con la tarjeta del enlace dentro. */}
        <div className="ml-auto w-full max-w-[280px] rounded-[10px] rounded-tr-sm bg-[#d9fdd3] p-1.5 shadow-sm">
          <div className="overflow-hidden rounded-[6px] bg-white">
            <div
              className="aspect-[1200/630] bg-[#e9edef]"
              style={{ backgroundImage: imagenUrl ? undefined : 'none' }}
            >
              {imagenUrl ? (
                <img
                  src={imagenUrl}
                  alt=""
                  onError={ocultarSiFalla}
                  className="size-full object-cover"
                />
              ) : (
                <p className="flex size-full items-center justify-center px-3 text-center text-[10px] text-[#667781]">
                  Sin imagen: WhatsApp enseñaría solo el texto
                </p>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className="line-clamp-2 text-[12px] leading-tight font-medium text-[#111b21]">
                {t}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-[#667781]">{d}</p>
              <p className="mt-1 truncate text-[11px] text-[#8696a0]">{dominio}</p>
            </div>
          </div>
          <p className="px-1 pt-1 text-[11px] text-[#111b21]">{dominio}</p>
        </div>
        <Medida valor={descripcion.length} techo={155} que="La descripción" />
      </div>
    </aside>
  );
}

/**
 * Google recorta por ANCHO, no por caracteres, así que el número es una guía y
 * no una regla: se avisa al pasarse, no se bloquea. Sin el aviso, James
 * escribiría un título de 120 caracteres y vería la mitad sin saber por qué.
 */
function Medida({ valor, techo, que }: { valor: number; techo: number; que: string }) {
  if (valor === 0) return null;
  const largo = valor > techo;
  return (
    <p className={largo ? 'text-danger mt-1.5 text-xs' : 'text-muted mt-1.5 text-xs'}>
      {largo
        ? `${que} tiene ${valor} caracteres: Google corta sobre los ${techo}.`
        : `${valor} de unos ${techo} caracteres`}
    </p>
  );
}
