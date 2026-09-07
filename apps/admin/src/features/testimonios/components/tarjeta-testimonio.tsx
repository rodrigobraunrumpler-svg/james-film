'use client';

import type { AdminTestimonialDto } from '@james-film/contracts';
import * as Popover from '@radix-ui/react-popover';
import { ArrowDown, ArrowUp, Lock, MessageCircle, MoreHorizontal, Star } from 'lucide-react';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { fecha } from '@/lib/format';
import { ocultarSiFalla } from '@/lib/imagen';
import { cn } from '@/lib/utils/cn';

export interface AccionesTestimonio {
  indice: number;
  total: number;
  /** Reordenar está bloqueado con un filtro puesto: mandaría un subconjunto. */
  puedeMover: boolean;
  onMover: (desde: number, hasta: number) => void;
  onConsentimiento: () => void;
  onPublicar: () => void;
  onDestacar: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}

/**
 * La tarjeta de un testimonio. El pie tenía SIETE controles con texto —dos
 * flechas, consentimiento, publicar, destacar, editar y borrar— y se leía como
 * una barra de herramientas, no como una tarjeta: tres filas de botones para
 * una foto y un nombre.
 *
 * Ahora hay **una sola acción visible, la que toca AHORA** según el estado, más
 * la estrella y el menú. Lo demás vive en `⋯`, igual que en Categorías y
 * Paquetes: la misma tarjeta en las tres pantallas, sin nada nuevo que aprender.
 */
export function TarjetaTestimonio({
  testimonio: t,
  acciones,
  i,
}: {
  testimonio: AdminTestimonialDto;
  acciones: AccionesTestimonio;
  /** Posición en la entrada escalonada. */
  i: number;
}) {
  return (
    <article
      className={cn(
        'entra levanta rounded-card elevada flex flex-col overflow-hidden border',
        // El sin consentimiento se distingue por el CONTINENTE, no por una
        // etiqueta más: es lo único que no se puede publicar (§19).
        !t.hasConsent
          ? 'border-danger-line bg-danger-bg'
          : t.isFeatured
            ? 'border-brass bg-card'
            : 'border-line bg-card',
      )}
      style={{ '--i': i } as React.CSSProperties}
    >
      <header className="flex min-w-0 items-center gap-2.5 p-3.5 pb-3">
        <Avatar testimonio={t} />

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="dato truncate font-medium">{t.authorName}</span>
          <span className="text-muted flex items-center gap-1.5 truncate text-xs">
            <Fuente fuente={t.source} />
            {t.eventType && <span className="dato truncate">{t.eventType}</span>}
            {t.eventDate && (
              <>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="shrink-0">{fecha(t.eventDate)}</span>
              </>
            )}
          </span>
        </div>

        {t.isFeatured && (
          <Star className="text-brass size-3.5 shrink-0 fill-current" aria-label="Destacado" />
        )}
        <Estado testimonio={t} />
      </header>

      {/* La valoración se puede rellenar en la hoja desde siempre y no se veía
          en ninguna parte: un dato que se pide y no se enseña es un dato que
          James rellena una vez y deja de rellenar. Va entre la cabecera y la
          captura, como en el prototipo, y solo si la hay. */}
      {t.rating !== null && t.rating !== undefined && (
        <div
          className="flex gap-0.5 px-3.5 pb-2.5"
          role="img"
          aria-label={`Valoración: ${t.rating} de 5`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden
              className={cn(
                'size-3.25',
                // Rellenas en latón de RELLENO, no en `brass`: son una forma, no
                // texto, y en claro el bronce de leer se ve apagado a 13px.
                n <= t.rating! ? 'text-brass-relleno fill-current' : 'text-sutil',
              )}
              strokeWidth={1.6}
            />
          ))}
        </div>
      )}

      {t.screenshotUrl && (
        // Techo de alto, no solo proporción: una captura de WhatsApp es un
        // retrato, y a ancho completo un 3:4 son 1500px de alto que se comen la
        // pantalla entera. Se recorta por abajo —`object-top`— porque lo que
        // dijo la clienta está arriba.
        <div className="bg-well border-line relative mx-3.5 max-h-72 overflow-hidden rounded-[6px] border">
          <img
            src={t.screenshotUrl}
            alt=""
            loading="lazy"
            onError={ocultarSiFalla}
            className={cn(
              'aspect-3/4 w-full object-cover object-top',
              // Difuminada mientras no haya permiso: se ve que hay algo, no se
              // lee lo que dijo alguien que no ha dado el sí.
              !t.hasConsent && 'blur-[6px]',
            )}
          />
          {!t.hasConsent && (
            <span className="bg-well/40 absolute inset-0 flex items-center justify-center">
              <Lock className="text-danger size-5" aria-hidden />
            </span>
          )}
        </div>
      )}

      {t.quote && (
        <blockquote className="text-ash dato line-clamp-3 px-3.5 pt-3 text-sm italic">
          «{t.quote}»
        </blockquote>
      )}

      {!t.hasConsent && (
        // El motivo escrito, no un tooltip: es lo único que explica por qué no
        // se puede publicar.
        <p className="text-danger px-3.5 pt-3 text-xs leading-relaxed">
          Sin el permiso de {t.authorName} no puede salir en la web.
        </p>
      )}

      <div className="border-line mt-auto flex items-center gap-1.5 border-t p-2.5 pt-3">
        <Primaria testimonio={t} acciones={acciones} />

        <button
          type="button"
          aria-label={
            t.isFeatured ? `Quitar destacado a ${t.authorName}` : `Destacar ${t.authorName}`
          }
          aria-pressed={t.isFeatured}
          onClick={acciones.onDestacar}
          className={clasesBoton(
            'secundario',
            cn('w-11 px-0 lg:w-[30px]', t.isFeatured && 'border-brass text-brass'),
          )}
        >
          <Star className={cn('size-3.5', t.isFeatured && 'fill-current')} aria-hidden />
        </button>

        <Menu testimonio={t} acciones={acciones} />
      </div>
    </article>
  );
}

/**
 * UNA acción, la que toca ahora. Sin permiso, lo único que se puede hacer es
 * pedirlo; con permiso, publicar; publicado, retirarlo. Tener las tres a la vez
 * obligaba a leer cuál estaba deshabilitada para saber en qué estado estabas.
 */
function Primaria({
  testimonio: t,
  acciones,
}: {
  testimonio: AdminTestimonialDto;
  acciones: AccionesTestimonio;
}) {
  if (!t.hasConsent) {
    return (
      <Boton variante="principal" className="flex-1" onClick={acciones.onConsentimiento}>
        Dio su permiso
      </Boton>
    );
  }
  return (
    <Boton
      variante={t.isActive ? 'secundario' : 'principal'}
      className="flex-1"
      onClick={acciones.onPublicar}
    >
      {t.isActive ? 'Despublicar' : 'Publicar'}
    </Boton>
  );
}

/** Lo de siempre, en Popover de Radix como en Categorías: cierra al pulsar fuera. */
function Menu({
  testimonio: t,
  acciones,
}: {
  testimonio: AdminTestimonialDto;
  acciones: AccionesTestimonio;
}) {
  const fila =
    'text-ash hover:bg-card-hover hover:text-bone rounded-control flex min-h-11 items-center gap-2 px-2.5 text-left text-sm transition-colors duration-150 disabled:opacity-35 lg:min-h-8';

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Más acciones para ${t.authorName}`}
        className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="border-line-strong bg-chrome rounded-control z-50 flex w-52 flex-col border p-1 shadow-[var(--sombra-flotante)] data-[state=open]:animate-[sube_0.15s_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <button type="button" onClick={acciones.onEditar} className={fila}>
            Editar
          </button>
          <button
            type="button"
            disabled={!acciones.puedeMover || acciones.indice === 0}
            onClick={() => acciones.onMover(acciones.indice, acciones.indice - 1)}
            className={fila}
          >
            <ArrowUp className="size-3.5" aria-hidden />
            Mover antes
          </button>
          <button
            type="button"
            disabled={!acciones.puedeMover || acciones.indice >= acciones.total - 1}
            onClick={() => acciones.onMover(acciones.indice, acciones.indice + 1)}
            className={fila}
          >
            <ArrowDown className="size-3.5" aria-hidden />
            Mover después
          </button>
          {t.hasConsent && (
            <button type="button" onClick={acciones.onConsentimiento} className={fila}>
              Quitar el permiso
            </button>
          )}
          <button
            type="button"
            onClick={acciones.onBorrar}
            className="text-danger hover:bg-danger-bg rounded-control flex min-h-11 items-center px-2.5 text-left text-sm transition-colors duration-150 lg:min-h-8"
          >
            Borrar
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Avatar({ testimonio: t }: { testimonio: AdminTestimonialDto }) {
  return (
    <span className="bg-active border-line-strong size-9 shrink-0 overflow-hidden rounded-full border">
      {t.avatarUrl ? (
        <img
          src={t.avatarUrl}
          alt=""
          loading="lazy"
          onError={ocultarSiFalla}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-brass flex h-full w-full items-center justify-center text-sm">
          {t.authorName.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * De dónde vino, en minúsculas y con icono. En mayúsculas —«WHATSAPP»— gritaba
 * más que el nombre de la clienta, que es lo único que hay que leer ahí.
 */
function Fuente({ fuente }: { fuente: AdminTestimonialDto['source'] }) {
  const nombre = {
    WHATSAPP: 'WhatsApp',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    DIRECTO: 'En persona',
  }[fuente];
  return (
    <span className="flex shrink-0 items-center gap-1">
      <MessageCircle className="size-3 shrink-0" aria-hidden />
      {nombre}
    </span>
  );
}

function Estado({ testimonio: t }: { testimonio: AdminTestimonialDto }) {
  if (!t.hasConsent) {
    return (
      <span className="text-danger bg-danger-line/30 shrink-0 rounded px-1.5 py-0.5 text-[10px]">
        Sin permiso
      </span>
    );
  }
  if (t.isActive) {
    return (
      <span className="text-brass border-brass/40 shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
        Publicado
      </span>
    );
  }
  return (
    <span className="text-ash bg-active shrink-0 rounded px-1.5 py-0.5 text-[10px]">Borrador</span>
  );
}
