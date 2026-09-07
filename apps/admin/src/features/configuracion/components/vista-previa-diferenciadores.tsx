'use client';

import type { AdminDifferentiatorDto } from '@james-film/contracts';
import { iconoDe } from '@/lib/iconos/mapa';

/**
 * La tira de diferenciadores como sale en la web, justo debajo del hero. Con
 * la paleta de la LANDING (`void #0A0908`, `bone`, `ash`), no la del admin:
 * dentro del marco se está enseñando la web.
 *
 * Solo los activos y en su orden: es lo que va a ver el cliente. Los ocultos
 * siguen en la lista de la izquierda, que es donde se gestionan.
 */
export function VistaPreviaDiferenciadores({ lista }: { lista: AdminDifferentiatorDto[] }) {
  const visibles = lista.filter((d) => d.isActive);

  return (
    <aside className="flex flex-col gap-2.5" aria-label="Vista previa de los diferenciadores">
      <p className="flex items-center gap-1.5">
        <span className="text-muted text-xs tracking-[0.1em] uppercase">Así se ve</span>
        <span className="bg-brass size-[5px] rounded-full" aria-hidden />
        <span className="text-muted text-xs">en vivo</span>
      </p>

      <div className="border-line-strong rounded-card overflow-hidden border bg-[#0A0908] p-4">
        {visibles.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#9C958C]">
            Ninguno activo: la web no pintaría esta sección.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {visibles.map((d) => {
              const Icono = iconoDe(d.icon);
              return (
                <li key={d.id} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-md border border-[#2E2A26] p-1.5">
                    <Icono className="size-3.5 text-[#C9A96A]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="dato block text-[13px] font-medium text-[#F2EFE9]">
                      {d.title}
                    </span>
                    {d.subtitle && (
                      <span className="dato mt-0.5 block text-[11px] leading-snug text-[#9C958C]">
                        {d.subtitle}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-muted text-xs leading-relaxed">
        Van bajo el hero. Son las tres o cuatro razones por las que alguien te elige a ti y no a
        otro.
      </p>
    </aside>
  );
}
