'use client';

import type { AdminMediaDto } from '@james-film/contracts';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  MoreHorizontal,
  RotateCcw,
  ShieldX,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { keys } from '@/lib/api/keys';
import { galerias } from '../services/galerias';
import { ocultarSiFalla } from '@/lib/imagen';
import { degradadoMedio } from '@/lib/degradado';
import { duracion } from '@/lib/format';
import { useEnLinea } from '@/lib/media/cola/conexion';
import { cola } from '@/lib/media/cola/store';
import type { ItemCola } from '@/lib/media/cola/tipos';
import { Boton } from '@/components/shared/boton';
import { Hoja } from '@/components/shared/hoja';
import { cn } from '@/lib/utils/cn';

const ETIQUETAS: Record<ItemCola['estado'], string> = {
  SELECCIONADO: 'En cola',
  VALIDANDO: 'Comprobando…',
  EXTRAYENDO_POSTER: 'Sacando la miniatura…',
  FIRMANDO: 'Preparando…',
  SUBIENDO: 'Subiendo',
  CONFIRMANDO: 'Terminando…',
  LISTO: 'Listo',
  FALLIDO: 'No se pudo subir',
};

export interface DatosTarjeta {
  clave: string;
  galleryId: string;
  nombre: string;
  posterUrl?: string | null;
  medio?: AdminMediaDto;
  item?: ItemCola;
}

export interface AccionesTarjeta {
  posicion: number;
  total: number;
  /** Abre el visor a pantalla completa. Solo para lo que ya está en R2. */
  onVer?: () => void;
  onMover: (desde: number, hasta: number) => void;
  onPortada: (mediaId: string) => void;
  onEditar: (mediaId: string, datos: { alt: string | null; caption: string | null }) => void;
}

/** Botón cuadrado del overlay. 44px en táctil (§7), 28 en escritorio. */
const ICONO =
  'pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong [background:var(--color-velo)] text-bone transition-colors duration-150 hover:border-line-hover disabled:opacity-35 lg:size-7';

export function TarjetaMedio({
  datos,
  acciones,
}: {
  datos: DatosTarjeta;
  acciones: AccionesTarjeta;
}) {
  const { item, medio } = datos;
  const [editando, setEditando] = useState(false);
  const [enAcciones, setAcciones] = useState(false);
  const [retirando, setRetirando] = useState(false);

  /**
   * Retirar NO es optimista y NO tiene deshacer.
   *
   * El resto del panel es optimista con reversión porque el objeto sigue en el
   * bucket; aquí el archivo se va de verdad, así que la tesela solo desaparece
   * cuando el servidor confirma — y si falla, se dice, porque el visitante que
   * lo pidió está esperando que ya no esté.
   */
  const qc = useQueryClient();
  const retirar = useMutation({
    mutationFn: (mediaId: string) => galerias.retirarMedio(mediaId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.galleries.detail(datos.galleryId) });
      toast.success('Retirado. Ya no se sirve desde la web.');
    },
    onError: () => toast.error('No se pudo retirar. Vuelve a intentarlo.'),
  });
  const subiendo = item && item.estado !== 'LISTO' && item.estado !== 'FALLIDO';
  const fallo = item?.estado === 'FALLIDO' ? item.motivo : (medio?.error ?? null);
  /** Se subió bien; solo hay algo que conviene saber. Nunca en rojo. */
  const aviso = !fallo ? (item?.aviso ?? null) : null;
  const porcentaje = Math.round((item?.progreso ?? 0) * 100);
  /** Fila PENDING sin item en la cola: la pestaña murió a media subida. */
  const procesando = !item && medio?.status === 'PENDING';
  const listo = medio?.status === 'READY' && !subiendo;
  /** La portada solo tiene sentido sobre algo que existe y se puede servir. */
  const puedeSerPortada = medio?.status === 'READY';
  const tiempo = duracion(medio?.durationSec);
  const puedeVerse = medio?.status === 'READY' && !subiendo && !fallo;
  const enLinea = useEnLinea();
  // Lo que está esperando a que vuelva la red. Un fallido ya no espera: pide
  // una decisión, y taparlo con «En cola» la escondería.
  const enEspera = Boolean(item) && (subiendo || item?.estado === 'SELECCIONADO');
  const { posicion, total } = acciones;

  return (
    <li
      className={cn(
        'group relative flex flex-col gap-1.5 lg:gap-0',
        // Arrastre nativo, solo escritorio. En táctil no hace nada a propósito:
        // los botones de mover son lo que se usa con el pulgar (§10) y son el
        // mismo camino de código.
        !subiendo && 'lg:cursor-grab',
      )}
      draggable={!subiendo}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(posicion))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const desde = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(desde)) acciones.onMover(desde, posicion);
      }}
    >
      {/* aspect-ratio reservado SIEMPRE: sin él, la miniatura al llegar empuja
          la grilla entera y el CLS se dispara. 3:4 y no 9:16: caben el doble
          por columna y el reel se sigue reconociendo.
          Es un <button> cuando hay algo que ver: así se abre también con
          teclado, sin cablear onKeyDown a mano sobre un div. */}
      <Marco
        onVer={puedeVerse ? acciones.onVer : undefined}
        nombre={datos.nombre}
        className={cn(
          'degradado relative aspect-3/4 w-full overflow-hidden rounded-[7px] border',
          fallo && 'border-danger-line bg-danger-bg',
          procesando && 'bg-card-hover border-line',
          !fallo && !procesando && 'bg-well',
          // Mientras sube, el borde sube a `line-strong`: la tesela que trabaja
          // se separa de las que ya están quietas.
          !fallo &&
            !procesando &&
            (medio?.isFeatured ? 'border-brass' : subiendo ? 'border-line-strong' : 'border-line'),
        )}
        // El degradado va DEBAJO de todo: es lo que se ve mientras el póster
        // carga, y lo único que hay cuando el vídeo aún no tiene miniatura.
        // Ocho teselas negras seguidas son indistinguibles entre sí.
        estilo={fallo || procesando ? undefined : degradadoMedio(datos.clave)}
      >
        {datos.posterUrl && !fallo ? (
          <img
            src={datos.posterUrl}
            alt=""
            loading="lazy"
            // Atenuada mientras sube: lo que manda entonces es el relleno de
            // latón, no la miniatura.
            // `center 35%` igual que en la lista: en un recorte 3:4 de algo
            // apaisado, el centro geométrico se come las caras.
            className={cn(
              'h-full w-full object-cover object-[center_35%]',
              subiendo && 'opacity-50',
            )}
            onError={ocultarSiFalla}
          />
        ) : null}

        {/* El objeto que trabaja ES el indicador: el latón sube llenando la
            miniatura. Sin barra aparte que mirar. */}
        {enLinea && subiendo && item.estado === 'SUBIENDO' && (
          <>
            <div
              className="border-brass absolute inset-x-0 bottom-0 origin-bottom border-t bg-[color-mix(in_oklab,var(--color-brass-relleno)_16%,transparent)] transition-transform duration-300 ease-linear"
              style={{ height: '100%', transform: `scaleY(${porcentaje / 100})` }}
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Subiendo ${datos.nombre}`}
            />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-medium">
              {porcentaje}%
            </span>
          </>
        )}

        {/* SIN RED, la tesela lo dice. Mientras dura el corte el item se queda
            en el estado que tenía, así que seguía anunciando «Subiendo» con la
            barra congelada en el 40% — que se lee como «se colgó», no como «no
            hay cobertura», y las dos cosas piden reacciones distintas. */}
        {!enLinea && enEspera && (
          <span className="bg-danger-bg/80 absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <RotateCcw className="text-danger size-4" aria-hidden strokeWidth={2} />
            <span className="text-danger text-[10px] font-medium">En cola</span>
          </span>
        )}

        {enLinea && (procesando || (subiendo && item.estado !== 'SUBIENDO')) && (
          <>
            {/* La franja diagonal del prototipo. Estática: un shimmer que
                recorre repinta en bucle para conseguir exactamente lo mismo. */}
            {procesando && (
              <span
                aria-hidden
                className="absolute inset-0 [background:linear-gradient(100deg,var(--color-card-hover)_20%,var(--color-line)_50%,var(--color-card-hover)_80%)]"
              />
            )}
            <span className="text-ash absolute inset-x-0 bottom-0 pb-3 text-center text-xs">
              {item ? ETIQUETAS[item.estado] : 'Procesando…'}
            </span>
          </>
        )}

        {fallo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.75 p-2.5 text-center">
            <AlertCircle className="text-danger size-[17px]" strokeWidth={1.8} aria-hidden />
            {/* El motivo dice QUÉ HACER, no «formato inválido». */}
            <p role="alert" className="text-danger text-xs leading-[1.35]">
              {fallo}
            </p>
            {item?.estado === 'FALLIDO' && (
              <button
                type="button"
                onClick={() => cola.reintentar(item.clientUploadId)}
                className="border-danger-line text-danger hover:bg-danger-line/20 rounded-[5px] border px-[9px] py-[3px] text-[10px] transition-colors duration-150"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {/* UNA insignia arriba a la izquierda, y la portada GANA al visto.
            El check dice que el archivo está arriba y servible —sin él, un medio
            listo y uno a medias se leen igual en cuanto desaparece la barra—,
            pero una portada ya es READY por definición (`puedeSerPortada` lo
            exige), así que enseñar los dos sería decir dos veces lo mismo en la
            esquina más pequeña de la tesela.

            Y es la MISMA estrella que en las demás teselas abre «Hacer portada»:
            ver el icono de la acción, relleno y en latón, es lo que dice «esta
            es la que está puesta» sin gastar una palabra. Aquí no cabe una: a
            112px —el ancho mínimo de la rejilla— el `⋯` de móvil se come 44 de
            los 112, y «Portada» escrito no entra. */}
        {medio?.isFeatured ? (
          <span
            aria-label="Es la portada"
            title="Es la portada de la galería"
            className="border-brass absolute top-1.75 left-1.75 flex size-[19px] items-center justify-center rounded-full border [background:var(--color-velo)]"
          >
            <Star className="text-brass size-[11px] fill-current" aria-hidden />
          </span>
        ) : listo ? (
          <span
            aria-label="Subido"
            title="Subido"
            className="border-brass absolute top-1.75 left-1.75 flex size-[19px] items-center justify-center rounded-full border [background:var(--color-velo)]"
          >
            <Check className="text-brass size-[11px]" strokeWidth={3} aria-hidden />
          </span>
        ) : null}

        {/* En `ash` y sin icono de alarma: el archivo está arriba y se ve. Un
            triángulo rojo por algo que no impide nada entrena a ignorarlos. */}
        {aviso && !subiendo && (
          <span
            title={aviso}
            className="text-ash absolute inset-x-1.75 bottom-1.75 line-clamp-2 rounded px-1.5 py-0.5 text-[10px] [background:var(--color-velo-fuerte)]"
          >
            {aviso}
          </span>
        )}

        {/* La palabra, abajo a la izquierda — y se APARTA al pasar el ratón.
            Comparte esquina exacta con la flecha «Mover antes» de la capa de
            acciones, así que al hacer hover quedaba media palabra asomando por
            detrás de un botón: se lee como algo roto, y es justo lo que hizo
            pensar que faltaba un control. Ahora se funde a la vez que la capa
            entra, y quien mira sigue sabiendo que es la portada por la estrella
            de arriba, que no la tapa nadie.

            En móvil no se aparta nunca: allí la capa de acciones no existe
            —`hidden lg:flex`— y nada la tapa. */}
        {medio?.isFeatured && (
          <span className="text-brass absolute bottom-1.75 left-1.75 rounded px-1.5 py-0.5 text-[10px] [background:var(--color-velo)] lg:transition-opacity lg:duration-200 lg:group-focus-within:opacity-0 lg:group-hover:opacity-0">
            Portada
          </span>
        )}

        {/* Táctil: un solo objetivo de 44px que abre la hoja. Una tesela no da
            para más, y esconder acciones detrás de un gesto no descubrible es
            peor que un botón visible. */}
        <span
          role="button"
          tabIndex={0}
          aria-label={`Acciones de ${datos.nombre}`}
          onClick={(e) => {
            // El marco es un <button>: sin esto, pulsar aquí abriría el visor.
            e.stopPropagation();
            setAcciones(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            setAcciones(true);
          }}
          className="border-line-strong text-bone absolute top-1.75 right-1.75 flex size-11 items-center justify-center rounded-full [background:var(--color-velo)] lg:hidden"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </span>

        {tiempo && !subiendo && !fallo && (
          <span className="absolute right-1.75 bottom-1.75 rounded px-1.5 py-0.5 text-[10px] [background:var(--color-velo)]">
            {tiempo}
          </span>
        )}
      </Marco>

      {/* `pointer-events-none` en la capa y `auto` en cada botón: con
          `opacity: 0` esta capa SIGUE recibiendo clics —solo `pointer-events`
          los desactiva— y se tragaba el de la miniatura, así que el visor no se
          abría nunca. Los huecos entre botones dejan pasar el clic al <button>
          de la miniatura que hay debajo.

          Solo en ESCRITORIO. En táctil no hay hover y, sobre todo, no caben:
          cuatro objetivos de 44px bajo una tesela de 130px se salen de la celda
          y se meten en la de al lado. Ahí las acciones van a una hoja, que es lo
          mismo que ya hace el resto del admin con lo que no cabe. */}
      <div
        className={cn(
          'pointer-events-none hidden flex-col gap-1.5 lg:absolute lg:inset-0 lg:flex lg:justify-between lg:p-1.75 lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100',
          // Mientras sube, Cancelar tiene que estar SIEMPRE a mano: es el botón
          // que hace falta justo cuando algo va mal.
          subiendo && 'lg:opacity-100',
        )}
      >
        <div className="flex justify-end gap-1">
          {puedeSerPortada && !medio.isFeatured && (
            <button
              type="button"
              onClick={() => acciones.onPortada(medio.id)}
              // «Hacer portada», no «Portada»: la etiqueta de la miniatura es el
              // ESTADO y esto es la ACCIÓN. Con la misma palabra, la tarjeta ya
              // marcada y la que no se leen igual.
              aria-label="Hacer portada"
              title="Hacer portada"
              className={ICONO}
            >
              <Star className="size-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // Mismo camino para cancelar, descartar y eliminar: el Media nace
              // PENDING en el presign, así que todos pasan por el DELETE.
              if (item) void cola.cancelar(item.clientUploadId);
              else if (medio) void cola.borrarMedio(medio.id, datos.galleryId);
            }}
            aria-label={subiendo ? 'Cancelar' : 'Eliminar'}
            title={subiendo ? 'Cancelar' : 'Eliminar'}
            className={ICONO}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className={cn('flex items-center gap-1', subiendo && 'lg:hidden')}>
          {/* Botones de mover: redundantes con el arrastre a propósito. Con más
              de ocho elementos en el móvil es lo único que se usa de verdad. */}
          <button
            type="button"
            aria-label={`Mover ${datos.nombre} antes`}
            title="Mover antes"
            disabled={posicion === 0}
            onClick={() => acciones.onMover(posicion, posicion - 1)}
            className={ICONO}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Mover ${datos.nombre} después`}
            title="Mover después"
            disabled={posicion >= total - 1}
            onClick={() => acciones.onMover(posicion, posicion + 1)}
            className={ICONO}
          >
            <ArrowRight className="size-3.5" aria-hidden />
          </button>

          {/* El `alt` es accesibilidad de la landing, no un adorno: sin él, un
              lector de pantalla anuncia «imagen» y ya. */}
          {medio && !editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              // El nombre accesible sigue al texto visible: si dicen cosas
              // distintas, quien usa lector de pantalla oye una acción y ve otra.
              aria-label={
                medio.alt
                  ? `Editar la descripción de ${datos.nombre}`
                  : `Añadir descripción a ${datos.nombre}`
              }
              className="border-line-strong [background:var(--color-velo)] text-bone hover:border-line-hover rounded-control pointer-events-auto flex min-h-11 min-w-0 flex-1 items-center justify-center truncate border px-1.5 text-[10px] transition-colors duration-150 lg:min-h-7"
            >
              {medio.alt ? 'Descripción ✓' : 'Añadir descripción'}
            </button>
          )}
        </div>
      </div>

      <Hoja
        abierta={enAcciones}
        onCerrar={() => setAcciones(false)}
        titulo={datos.nombre}
        descripcion="Qué hacer con este archivo"
      >
        <ul className="flex flex-col gap-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {puedeSerPortada && !medio.isFeatured && (
            <FilaAccion
              Icono={Star}
              etiqueta="Hacer portada"
              onClick={() => {
                acciones.onPortada(medio.id);
                setAcciones(false);
              }}
            />
          )}
          {medio && (
            <FilaAccion
              Icono={Check}
              etiqueta={medio.alt ? 'Editar la descripción' : 'Añadir descripción'}
              onClick={() => {
                setAcciones(false);
                setEditando(true);
              }}
            />
          )}
          <FilaAccion
            Icono={ArrowLeft}
            etiqueta="Mover antes"
            deshabilitada={posicion === 0}
            onClick={() => {
              acciones.onMover(posicion, posicion - 1);
              setAcciones(false);
            }}
          />
          <FilaAccion
            Icono={ArrowRight}
            etiqueta="Mover después"
            deshabilitada={posicion >= total - 1}
            onClick={() => {
              acciones.onMover(posicion, posicion + 1);
              setAcciones(false);
            }}
          />
          <FilaAccion
            Icono={Trash2}
            peligro
            etiqueta={subiendo ? 'Cancelar la subida' : 'Eliminar'}
            onClick={() => {
              if (item) void cola.cancelar(item.clientUploadId);
              else if (medio) void cola.borrarMedio(medio.id, datos.galleryId);
              setAcciones(false);
            }}
          />
          {/* Separada de «Eliminar» a propósito: eliminar deja el archivo en el
              bucket 30 días y se deshace; esto lo borra ahora y no. Un
              `?definitivo=true` en la misma fila se pulsa por error. */}
          {medio && (
            <FilaAccion
              Icono={ShieldX}
              peligro
              etiqueta="Retirar por solicitud"
              onClick={() => {
                setAcciones(false);
                setRetirando(true);
              }}
            />
          )}
        </ul>
      </Hoja>

      {medio && (
        <Hoja
          abierta={retirando}
          onCerrar={() => setRetirando(false)}
          titulo="¿Alguien pidió que se retire?"
          descripcion="Se borra del servidor ahora mismo. Esto no se puede deshacer."
        >
          <div className="flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="text-muted text-xs leading-relaxed">
              Úsalo cuando quien aparece en el material pida que lo quites. A diferencia de
              «Eliminar», el archivo deja de estar accesible por su enlace inmediatamente, también
              para quien ya lo tuviera. Lo que otra persona haya descargado antes queda fuera de
              tu alcance.
            </p>
            <div className="flex gap-2">
              <Boton className="flex-1" onClick={() => setRetirando(false)}>
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                className="flex-1"
                onClick={() => {
                  void retirar.mutateAsync(medio.id);
                  setRetirando(false);
                }}
              >
                Retirar ahora
              </Boton>
            </div>
          </div>
        </Hoja>
      )}

      {/* En hoja, no en línea: metido bajo una tesela de 130px el formulario
          quedaba ilegible y rompía la grilla. Y es lo que ya hace el resto del
          admin con cualquier formulario de edición. */}
      {medio && (
        <Hoja
          abierta={editando}
          onCerrar={() => setEditando(false)}
          titulo={medio.alt ? 'Editar la descripción' : 'Añadir descripción'}
          descripcion="Lo que un lector de pantalla anuncia en la web, y el pie que se ve bajo el medio."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formulario = new FormData(e.currentTarget);
              acciones.onEditar(medio.id, {
                alt: (formulario.get('alt') as string).trim() || null,
                caption: (formulario.get('caption') as string).trim() || null,
              });
              setEditando(false);
            }}
            className="flex flex-col gap-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex flex-col gap-1.25">
              <label htmlFor={`alt-${medio.id}`} className="text-muted text-xs">
                Descripción para lectores de pantalla
              </label>
              <input
                id={`alt-${medio.id}`}
                name="alt"
                defaultValue={medio.alt ?? ''}
                autoFocus
                placeholder="Los novios bailando en la recepción"
                className="campo border-line"
              />
              <p className="text-muted text-xs">
                Sin esto, quien navegue con lector de pantalla oye «imagen» y ya. Describe lo que se
                ve, no lo que es.
              </p>
            </div>

            <div className="flex flex-col gap-1.25">
              <label htmlFor={`caption-${medio.id}`} className="text-muted text-xs">
                Pie
              </label>
              <input
                id={`caption-${medio.id}`}
                name="caption"
                defaultValue={medio.caption ?? ''}
                className="campo border-line"
              />
              <p className="text-muted text-xs">Opcional. Se ve debajo del medio en la web.</p>
            </div>

            <div className="flex gap-2">
              <Boton className="flex-1" onClick={() => setEditando(false)}>
                Cancelar
              </Boton>
              <Boton variante="principal" type="submit" className="flex-1">
                Guardar
              </Boton>
            </div>
          </form>
        </Hoja>
      )}
    </li>
  );
}

/**
 * La miniatura es un `<button>` cuando hay algo que abrir y un `<div>` cuando
 * no. Un botón siempre —deshabilitado mientras sube— saldría en el tabulador
 * como un control muerto por cada archivo en vuelo.
 */
function Marco({
  onVer,
  nombre,
  className,
  estilo,
  children,
}: {
  onVer?: () => void;
  nombre: string;
  className: string;
  estilo?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!onVer) {
    return (
      <div className={className} style={estilo}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onVer}
      aria-label={`Ver ${nombre}`}
      className={className}
      style={estilo}
    >
      {children}
    </button>
  );
}

/** Fila de la hoja de acciones. 44px, icono a la izquierda y texto completo. */
function FilaAccion({
  Icono,
  etiqueta,
  onClick,
  deshabilitada,
  peligro,
}: {
  Icono: typeof Star;
  etiqueta: string;
  onClick: () => void;
  deshabilitada?: boolean;
  peligro?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={deshabilitada}
        className={cn(
          'hover:bg-card-hover rounded-control flex min-h-12 w-full items-center gap-3 px-3 text-left transition-colors duration-150 disabled:opacity-40',
          peligro ? 'text-danger' : 'text-bone',
        )}
      >
        <Icono
          className={cn('size-4 shrink-0', peligro ? 'text-danger' : 'text-brass')}
          aria-hidden
        />
        {etiqueta}
      </button>
    </li>
  );
}
