import { Film } from 'lucide-react';
import { Suspense } from 'react';
import { FormularioLogin } from '@/features/auth/components/formulario-login';
import { Saludo } from '@/features/auth/components/saludo';

export const metadata = { title: 'Entrar · James Film' };

/**
 * «Sala oscura»: sin tarjeta, la pantalla entera es la superficie. Dos campos
 * dentro de una caja centrada es la plantilla de cualquier panel; lo que se
 * recuerda aquí es el titular, que es lo único que habla de James.
 */
export default function Page() {
  return (
    // Anclado ARRIBA por debajo de 640px de alto y centrado por encima: con el
    // teclado del iPhone abierto el viewport baja a ~400px, y centrando sobre
    // lo poco que queda el botón «Entrar» se sale de la pantalla.
    <main className="bg-content relative grid min-h-dvh items-start px-6 pt-12 pb-[calc(3rem+8vh)] [@media(min-height:640px)]:items-center">
      {/* Decoración: fuera del árbol accesible y sin capturar el puntero.
          El `overflow-hidden` va en ESTA capa y no en el <main>: la luz sale por
          arriba y por la derecha, y sin recortarla el documento crecía y salían
          las dos barras de scroll. Recortando el <main> entero se cortaría el
          formulario en una pantalla baja o con el teclado del iPhone abierto. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="luz-set absolute -top-[25%] -right-[10%] aspect-square w-[min(80%,760px)] animate-[aparece_0.35s_ease_both,deriva_26s_ease-in-out_0.35s_infinite_alternate] rounded-full" />
        <div className="grano absolute inset-0 opacity-5" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[min(1080px,92vw)] gap-10 lg:grid-cols-[1.05fr_1px_0.95fr] lg:items-center lg:gap-0">
        <div className="lg:pr-14 xl:pr-20">
          <p
            className="entra text-ash font-display mb-4.5 flex items-center gap-2.25 text-xs font-extrabold tracking-[0.2em]"
            style={{ '--i': 0 } as React.CSSProperties}
          >
            <Film className="text-brass size-4 shrink-0" aria-hidden />
            JAMES FILM
          </p>

          {/* `clamp` y no un salto por breakpoint: entre 320 y 860px el titular
              crece de forma continua y nunca parte «Buenas noches» en tres. */}
          <h1 className="font-display mb-3.5 text-[clamp(28px,4.6vw,56px)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
            <span className="entra inline-block" style={{ '--i': 1 } as React.CSSProperties}>
              <Saludo />
            </span>{' '}
            <span className="entra inline-block" style={{ '--i': 2 } as React.CSSProperties}>
              James.
            </span>
          </h1>

          <p className="entra text-ash max-w-[34ch]" style={{ '--i': 3 } as React.CSSProperties}>
            Entra y sigue donde lo dejaste.
          </p>
        </div>

        <div
          aria-hidden
          className="bg-line hidden origin-top animate-[crece-y_0.45s_cubic-bezier(0.2,0.8,0.2,1)_240ms_both] lg:block lg:self-stretch"
        />

        {/* useSearchParams exige Suspense en el App Router. */}
        <Suspense fallback={null}>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
