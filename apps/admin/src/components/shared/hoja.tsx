'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

/**
 * El contenedor de todo formulario de edición. Sube desde abajo **por encima**
 * de la lista, en vez de desplegarse debajo de ella.
 *
 * Por qué importa: con un panel en línea, pulsar «Editar» en la tercera fila
 * pintaba el formulario **fuera de la pantalla** del iPhone. No pasaba nada
 * visible y había que bajar con el dedo a buscarlo; al guardar, la página daba
 * un salto porque el contenido se encogía.
 *
 * **Una sola hoja, también en escritorio**, y no un diálogo aparte: en pantalla
 * ancha se centra con `max-w-2xl` y se lee igual de bien. Escribir un segundo
 * modal para el sitio donde el admin se usa MENOS no vale lo que cuesta, y
 * `vaul` envuelve el Dialog de Radix, así que el foco atrapado, el `Escape` y
 * el anuncio del lector de pantalla vienen resueltos.
 *
 * El `Description` no es decorativo: sin él, Radix avisa por consola de que al
 * diálogo le falta descripción accesible.
 */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={abierta} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <Drawer.Portal>
        <Drawer.Overlay className="bg-well/70 fixed inset-0 z-40" />
        <Drawer.Content
          className="bg-chrome border-line fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-2xl flex-col rounded-t-xl border-t outline-none"
          aria-describedby={descripcion ? undefined : 'hoja-sin-descripcion'}
        >
          {/* El asa: es lo que dice «esto se arrastra». Sin ella, la hoja
              parece un modal y nadie prueba a bajarla con el pulgar. */}
          <Drawer.Handle className="bg-line-strong mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full" />

          <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <Drawer.Title className="dato text-lg font-semibold">{titulo}</Drawer.Title>
              <Drawer.Description
                id={descripcion ? undefined : 'hoja-sin-descripcion'}
                className={descripcion ? 'text-ash text-sm' : 'sr-only'}
              >
                {descripcion ?? titulo}
              </Drawer.Description>
            </div>
            <Drawer.Close
              aria-label="Cerrar"
              className="text-ash hover:text-bone rounded-control flex size-11 shrink-0 items-center justify-center transition-colors duration-150"
            >
              <X className="size-5" aria-hidden />
            </Drawer.Close>
          </div>

          {/* El scroll vive AQUÍ, no en la página: la cabecera con el título y
              el botón de cerrar se quedan fijos mientras el formulario sube. */}
          {/* SIN `padding-bottom`: `sticky bottom-0` se ancla a la caja de
              CONTENIDO, así que un padding aquí deja al pie pegado flotando por
              encima de ese hueco y el formulario se ve pasar por debajo. El
              respiro y el área segura los pone quien va al final. */}
          <div className="overflow-y-auto px-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
