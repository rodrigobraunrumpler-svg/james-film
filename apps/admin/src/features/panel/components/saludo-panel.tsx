'use client';

import { useEffect, useState } from 'react';

const fmtDia = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function saludoDe(hora: number): string {
  if (hora < 6) return 'Buenas noches';
  if (hora < 13) return 'Buenos días';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * El saludo por hora se calcula DESPUÉS de montar, igual que en el login: en el
 * servidor renderizaría «Buenas tardes» y el navegador «Buenas noches», y React
 * descarta el árbol entero por error de hidratación. Arranca en «Hola», cierto
 * a cualquier hora, para que el titular no salte.
 *
 * La hora se pide en `America/Lima` explícitamente: el contenedor va en UTC y
 * sin eso James vería «buenas noches» a media tarde.
 */
export function SaludoPanel({ pendientes }: { pendientes: number }) {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => setAhora(new Date()), []);

  const hora = ahora
    ? Number(
        new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: 'numeric',
          hour12: false,
        }).format(ahora),
      )
    : null;

  return (
    <div className="entra">
      <h1 className="font-display text-[clamp(20px,4vw,26px)] leading-[1.15] font-extrabold tracking-[-0.02em]">
        {hora === null ? 'Hola, James.' : `${saludoDe(hora)}, James.`}
      </h1>
      <p className="text-ash mt-1.5 text-sm first-letter:uppercase">
        {ahora ? fmtDia.format(ahora) : ' '}
        {pendientes > 0 && (
          <>
            {' · '}
            {pendientes === 1
              ? 'te queda 1 cosa por mirar'
              : `te quedan ${pendientes} cosas por mirar`}
          </>
        )}
      </p>
    </div>
  );
}
