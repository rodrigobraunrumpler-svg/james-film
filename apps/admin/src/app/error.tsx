'use client';

import { useEffect } from 'react';
import { Boton, clasesBoton } from '@/components/shared/boton';

/**
 * Sin este fichero, un componente que revienta al renderizar deja a James ante
 * una **pantalla en blanco**: ni mensaje, ni forma de reintentar, ni pista de
 * que la culpa no es suya.
 *
 * No se enseña el mensaje del error: para quien lo lee no significa nada y
 * puede filtrar detalles internos. El detalle va a la consola —y a Sentry en la
 * fase 6, vía `instrumentation.ts`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">Algo se rompió en esta pantalla</p>
        <p className="text-ash max-w-md text-sm">
          No es culpa tuya y no has perdido nada de lo que ya estaba guardado. Vuelve a intentarlo;
          si sigue pasando, avísame.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Boton variante="principal" onClick={reset}>
          Reintentar
        </Boton>
        <a href="/" className={clasesBoton()}>
          Volver a las galerías
        </a>
      </div>

      {/* El digest es lo único que sirve para encontrarlo en los logs. */}
      {error.digest && <p className="dato text-muted text-xs">Referencia: {error.digest}</p>}
    </div>
  );
}
