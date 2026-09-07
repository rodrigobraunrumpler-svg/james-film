'use client';

import { MessageCircle } from 'lucide-react';
import { ocultarSiFalla } from '@/lib/imagen';

/**
 * La primera pantalla de la web, en un marco de móvil y PEGADA arriba mientras
 * se hace scroll: cambias un campo y ves el efecto sin moverte. Es lo que quita
 * el «¿dónde salía esto?» — sin ella, Configuración es una lista de cajas de
 * texto sin sitio conocido.
 *
 * Es el ÚNICO lugar del admin donde aparece el verde de WhatsApp (§6 lo reserva
 * a la landing). Dentro del marco ya no estamos en el admin: es la web.
 */
export function VistaPreviaHero({
  titular,
  bajada,
  cta,
  numero,
  posterUrl,
}: {
  titular: string;
  bajada: string;
  cta: string;
  numero: string;
  posterUrl: string | null;
}) {
  return (
    <aside className="flex flex-col gap-2.5" aria-label="Vista previa de la web">
      <p className="flex items-center gap-1.5">
        <span className="text-muted text-xs tracking-[0.1em] uppercase">Así se ve</span>
        <span className="bg-brass size-[5px] rounded-full" aria-hidden />
        <span className="text-muted text-xs">en vivo</span>
      </p>

      <div className="border-line-strong bg-well rounded-[22px] border p-[7px] shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
        <div
          className="relative aspect-[9/16] overflow-hidden rounded-[16px]"
          // La paleta de la LANDING (`void #0A0908`), no la del admin: dentro
          // del marco se está enseñando la web, y mezclarlas haría que la
          // previa no se pareciera a lo que James va a publicar.
          style={{
            background: 'radial-gradient(120% 90% at 50% 15%, #2B2620, #141210 55%, #0A0908)',
          }}
        >
          {posterUrl && (
            <img
              src={posterUrl}
              alt=""
              onError={ocultarSiFalla}
              className="size-full object-cover"
            />
          )}

          <span
            aria-hidden
            className="absolute top-2 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[rgba(242,239,233,0.14)]"
          />

          <div className="absolute inset-0 flex flex-col justify-end gap-2.5 bg-[linear-gradient(to_top,rgba(10,9,8,0.94)_22%,transparent_62%)] px-3.5 pt-4 pb-4.5">
            <p className="font-display dato text-[19px] leading-[1.1] font-extrabold tracking-[-0.02em] text-[#F2EFE9]">
              {titular || 'Tu evento, en 60 segundos.'}
            </p>
            {bajada && <p className="dato text-[10px] leading-snug text-[#9C958C]">{bajada}</p>}

            {/* El único verde del admin, y solo aquí dentro. */}
            <p className="flex h-[34px] items-center justify-center gap-1.5 rounded-[7px] bg-[#25D366] text-sm font-semibold text-[#0A0908]">
              <MessageCircle className="size-3.5" aria-hidden />
              {cta || 'Escríbeme por WhatsApp'}
            </p>
            {numero && <p className="text-center text-[9px] text-[#9C958C]">+{numero}</p>}
          </div>
        </div>
      </div>

      <p className="text-muted text-xs leading-relaxed">
        El titular y el eslogan que escribes arriba salen aquí. Así se ve en el tema oscuro de la
        web, que es el que sale por defecto.
      </p>
    </aside>
  );
}
