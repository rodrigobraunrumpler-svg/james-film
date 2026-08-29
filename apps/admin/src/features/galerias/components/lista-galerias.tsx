'use client';

import { Images, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
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
  const { data: recuentos } = useRecuentosGalerias();

  return (
    <div className="border-line flex items-center gap-5 border-b" role="tablist">
      {ESTADOS_GALERIA.map((estado) => {
        const seleccionada = estado === activa;
        const cuantas = recuentos?.data[estado];
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
  const [creando, setCreando] = useState(false);
  const { filtros, setFiltros } = useFiltrosGalerias();
  const { data, isPending, isFetching, isError, error, refetch } = useGalerias(filtros);

  const cabecera = (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Galerías</h1>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 sm:flex-none">
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
            explicacion="Una galería es un evento: los reels de una boda, unos XV, un cumpleaños."
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
