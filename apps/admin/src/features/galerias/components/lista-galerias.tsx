'use client';

import { Images, Plus, SearchX } from 'lucide-react';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { Boton } from '@/components/shared/boton';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { esApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import { useFiltrosGalerias } from '../hooks/use-filtros-galerias';
import { useGalerias } from '../hooks/use-galerias';
import { useRecuentosGalerias } from '../hooks/use-recuentos-galerias';
import { ESTADOS_GALERIA, type EstadoGaleria } from '../services/galerias';

import { BuscadorGalerias } from './buscador-galerias';
import { NuevaGaleria } from './nueva-galeria';
import { TarjetaGaleria } from './tarjeta-galeria';
import { SkeletonLista } from './skeleton-lista';

const ETIQUETA: Record<EstadoGaleria, string> = {
  todas: 'Todas',
  publicadas: 'Publicadas',
  borradores: 'Borradores',
};

function Pestanas({
  activa,
  alCambiar,
}: {
  activa: EstadoGaleria;
  alCambiar: (estado: EstadoGaleria) => void;
}) {
  // Si los recuentos fallan o aún no han llegado, la pestaña se pinta SIN
  // número. Un «0» mientras carga se lee como «no hay», que suele ser justo lo
  // contrario de lo que es cierto.
  const recuentos = useRecuentosGalerias();

  return (
    <div className="border-line flex items-center gap-5 border-b" role="tablist">
      {ESTADOS_GALERIA.map((estado) => {
        const seleccionada = estado === activa;
        const cuantas = recuentos?.[estado];
        return (
          <button
            key={estado}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            onClick={() => alCambiar(estado)}
            // -mb-px monta el borde inferior sobre la línea del contenedor:
            // sin eso la pestaña activa queda dos píxeles por encima.
            className={cn(
              '-mb-px flex h-11 items-center gap-1.75 border-b-2 transition-colors duration-150 lg:h-10',
              seleccionada
                ? 'border-brass text-bone font-medium'
                : 'text-ash hover:text-bone border-transparent',
            )}
          >
            {ETIQUETA[estado]}
            {cuantas !== undefined && (
              <span className={cn('text-sm', seleccionada ? 'text-ash' : 'text-muted')}>
                {cuantas}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ListaGalerias() {
  /**
   * `?nueva=true` abre el formulario nada más entrar. Es lo que hace que el atajo
   * «Nueva galería» del panel y del ⌘K NO acaben soltando a James en la lista
   * a buscar el botón: llegan con el formulario ya abierto.
   *
   * En la URL y con `clearOnDefault`, como el resto del estado de esta
   * pantalla: cerrar el formulario limpia el parámetro solo, así que recargar
   * después no lo vuelve a abrir.
   */
  const [creando, setCreandoUrl] = useQueryState(
    'nueva',
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
  );
  const setCreando = (v: boolean): void => void setCreandoUrl(v || null);
  const { filtros, setFiltros } = useFiltrosGalerias();
  const { data, isPending, isFetching, isError, error, refetch } = useGalerias(filtros);

  const cabecera = (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Galerías</h1>
          {/* Era la única de las cinco listas sin línea de contexto, y es la
              pantalla de entrada: la que más falta hace. */}
          <p className="text-ash text-sm">
            Cada evento que has cubierto. Lo que abres veinte veces al día.
          </p>
        </div>
        {/* `flex-1 min-w-0` SIEMPRE, sin `sm:flex-none`: con el grupo a tamaño
            de contenido, el buscador y el botón sumaban más que la pantalla en
            cuanto el texto crecía —con el zoom al 200%, que es lo que usa quien
            no ve bien, se salían 50px—. `basis-56` le da su sitio natural y
            deja que encoja cuando no lo hay. */}
        <div className="flex min-w-0 flex-1 basis-56 items-center justify-end gap-2.5">
          <BuscadorGalerias
            valor={filtros.q}
            // Vuelve a la página 1: buscar desde la página 3 daría una lista
            // vacía aunque haya resultados.
            alBuscar={(q) => void setFiltros({ q: q || null, page: 1 })}
          />
          {!creando && (
            <Boton className="shrink-0" onClick={() => setCreando(true)}>
              <Plus className="text-brass size-3.5" aria-hidden />
              <span className="hidden sm:inline">Nueva galería</span>
              <span className="sm:hidden">Nueva</span>
            </Boton>
          )}
        </div>
      </div>

      <Pestanas
        activa={filtros.estado}
        // La página vuelve a 1: sin esto, cambiar a «Borradores» desde la página
        // 3 deja una lista vacía que parece que no hay borradores.
        alCambiar={(estado) => void setFiltros({ estado, page: 1 })}
      />
    </div>
  );

  // PRIMERA carga: skeleton. Un refetch NO vuelve aquí (keepPreviousData).
  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <SkeletonLista />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <div
          role="alert"
          className="rounded-card border-danger-line bg-danger-bg flex flex-col items-start gap-3 border p-5"
        >
          <p className="font-medium">No se pudieron cargar las galerías</p>
          <p className="text-ash text-sm">
            {esApiError(error) ? error.message : 'Revisa tu conexión.'}
          </p>
          <Boton onClick={() => void refetch()}>Reintentar</Boton>
        </div>
      </div>
    );
  }

  const galerias = data.data;
  const meta = data.meta;
  const vacia = galerias.length === 0 && meta?.currentPage === 1;

  return (
    <div className="flex flex-col gap-5">
      {cabecera}

      {/* Montada siempre: vaul necesita el nodo vivo para animar la salida. */}
      <NuevaGaleria abierta={creando} onCerrar={() => setCreando(false)} />

      {vacia && !creando ? (
        filtros.q ? (
          <EstadoVacio
            Icono={SearchX}
            titulo={`Nada que coincida con «${filtros.q}»`}
            explicacion="Se busca solo en el título de la galería, sin distinguir mayúsculas."
            accion="Limpiar la búsqueda"
            onAccion={() => void setFiltros({ q: null, page: 1 })}
          />
        ) : filtros.estado === 'todas' ? (
          // El botón del estado vacío ABRE el formulario. Antes recibía un
          // `alCrear` opcional que nadie le pasaba: se pintaba y no hacía nada.
          <EstadoVacio
            Icono={Images}
            titulo="Aún no tienes galerías"
            explicacion="Una galería es un evento: la boda, los XV, el cumpleaños. Dentro van los reels que grabaste, y es lo que compartes por WhatsApp."
            accion="Crear la primera"
            onAccion={() => setCreando(true)}
          />
        ) : (
          <EstadoVacio
            Icono={Images}
            titulo={`No hay ${ETIQUETA[filtros.estado].toLowerCase()}`}
            explicacion={
              filtros.estado === 'borradores'
                ? 'Todo lo que tienes está publicado y visible en la web.'
                : 'Todavía no has publicado ninguna galería.'
            }
            accion="Ver todas"
            onAccion={() => void setFiltros({ estado: 'todas', page: 1 })}
          />
        )
      ) : (
        // Refetch con datos en pantalla: se atenúa, no se sustituye por skeleton.
        <ul
          className={cn(
            'grid gap-4.5 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
            isFetching && 'opacity-60',
          )}
        >
          {galerias.map((g) => (
            <TarjetaGaleria key={g.id} galeria={g} />
          ))}
        </ul>
      )}

      {meta && meta.pageCount > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <Boton
            // `isFirstPage` viaja en el meta justo para esto: el cliente no repite
            // la aritmética de paginación en cada control que pinta.
            disabled={meta.isFirstPage}
            onClick={() => void setFiltros({ page: meta.previousPage })}
          >
            Anterior
          </Boton>

          <span className="text-ash text-sm">
            Página {meta.currentPage} de {meta.pageCount} · {meta.totalCount} en total
          </span>

          <Boton
            disabled={meta.isLastPage}
            onClick={() => void setFiltros({ page: meta.nextPage })}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </div>
  );
}
