import type { AdminGalleryListItemDto } from '@james-film/contracts';
import { CirclePlay, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { duracion, relativo } from '@/lib/format';
import { ocultarSiFalla } from '@/lib/imagen';
import { degradadoDe } from '@/lib/degradado';

const ES_VIDEO = new Set(['REEL', 'AFTERMOVIE']);

/**
 * Tarjeta, no fila: lo que James reconoce de un evento es la imagen, no el
 * título. Una tabla de texto le obliga a leer para encontrar la boda de Ana;
 * la portada se la señala de un vistazo.
 *
 * `object-[center_35%]` y no `center`: en un 9:16 recortado a 16:10, el centro
 * geométrico cae en el torso. El tercio superior es donde están las caras.
 */
export function TarjetaGaleria({ galeria }: { galeria: AdminGalleryListItemDto }) {
  const tiempo = duracion(galeria.coverDurationSec);
  const esVideo = galeria.coverType !== null && ES_VIDEO.has(galeria.coverType);

  return (
    <li>
      <Link
        href={`/galerias/${galeria.id}`}
        className="group rounded-card border-line bg-card hover:border-line-hover hover:bg-card-hover flex h-full flex-col overflow-hidden border transition duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
      >
        {/* El degradado va DEBAJO de la imagen: se ve mientras carga y es lo
            único que hay cuando la galería aún no tiene portada. */}
        <div className="relative aspect-16/10" style={{ background: degradadoDe(galeria.id) }}>
          {galeria.coverUrl && (
            <Image
              src={galeria.coverUrl}
              alt=""
              fill
              // Los tres anchos de todo el sitio. §4 §17.
              sizes="(min-width: 1536px) 400px, (min-width: 640px) 50vw, 100vw"
              className="object-cover object-[center_35%]"
              unoptimized
              // Una portada que no carga —R2 caído, clave movida a mano, el
              // endpoint local sin levantar— dejaba el icono de imagen rota
              // sobre la tarjeta. Escondiéndola se ve el degradado, que es
              // exactamente lo que se ve en una galería que aún no tiene
              // portada: un fallo de red no debe parecer un fallo de datos.
              onError={ocultarSiFalla}
            />
          )}

          {/* Círculo + triángulo, como el reproductor del prototipo. `CirclePlay`
              dibuja las dos formas en un mismo trazo: con un `Play` dentro de un
              `ring`, el círculo queda a un grosor distinto que el triángulo. */}
          {esVideo && (
            <span
              aria-hidden
              className="text-bone/35 group-hover:text-bone/60 absolute inset-0 flex items-center justify-center transition-colors duration-200"
            >
              <CirclePlay className="size-[30px]" strokeWidth={1.2} />
            </span>
          )}

          {/* El estado va donde James mira primero: sin esto, un borrador y una
              galería en vivo se leen exactamente igual. El fondo casi opaco es
              lo que lo mantiene legible sobre una portada clara. */}
          {!galeria.isPublished && (
            <span className="text-brass absolute top-2 left-2 rounded px-1.75 py-0.5 text-xs [background:rgba(8,7,6,.82)]">
              Borrador
            </span>
          )}

          <span className="text-bone absolute top-2 right-2 rounded px-1.75 py-0.5 text-xs [background:rgba(8,7,6,.82)]">
            {galeria.mediaCount} {galeria.mediaCount === 1 ? 'medio' : 'medios'}
          </span>

          {tiempo && (
            <span className="text-bone absolute right-2 bottom-2 rounded px-1.75 py-0.5 text-xs [background:rgba(8,7,6,.82)]">
              {tiempo}
            </span>
          )}

          {galeria.isFeatured && (
            <span
              title="Destacada en la portada de la web"
              className="text-brass absolute bottom-2 left-2 flex items-center gap-1 rounded px-1.75 py-0.5 text-xs [background:rgba(8,7,6,.82)]"
            >
              <Star className="size-3 fill-current" aria-hidden />
              Portada
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.75 px-3 pt-2.75 pb-3.25">
          {/* dato: un título sin espacios no debe romper la tarjeta (§7). */}
          <span className="dato line-clamp-2 font-medium">{galeria.title}</span>
          <span className="text-ash truncate text-sm">
            {galeria.category.name} · {galeria.isPublished ? 'Publicada' : 'Editada'}{' '}
            {relativo(galeria.updatedAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}
