'use client';

import { Toaster } from 'sonner';
import { useTema } from '@/lib/use-tema';

/**
 * El `<Toaster>` con el tema que toca. Estaba fijo en `theme="dark"`, que en
 * claro pinta un toast casi negro sobre un panel blanco — se lee como un
 * agujero, que es justo lo contrario de lo que tiene que hacer algo que
 * aparece encima de todo.
 *
 * Arriba a propósito: abajo chocaría con la barra de subidas, que es `sticky`
 * y está justo donde caería el toast.
 */
export function ToasterDelTema() {
  const { aplicado } = useTema();

  return (
    <Toaster
      position="top-center"
      theme={aplicado === 'claro' ? 'light' : 'dark'}
      closeButton
      // Las clases son las MISMAS en los dos temas: salen de tokens, así que
      // `bg-card` ya es blanco en claro y casi negro en oscuro, y la sombra
      // sale de `--sombra-flotante`, que cada tema define a su manera.
      toastOptions={{
        classNames: {
          toast:
            'bg-card! border-line-strong! text-bone! rounded-card! gap-3! shadow-[var(--sombra-flotante)]',
          title: 'font-medium',
          description: 'text-ash!',
          icon: 'text-brass',
          actionButton: 'bg-transparent! border border-brass text-brass! font-medium',
          cancelButton: 'bg-transparent! text-ash!',
          closeButton:
            'bg-card! border-line-strong! text-ash! hover:text-bone! hover:bg-card-hover!',
          error: 'border-danger-line! [&_[data-icon]]:text-danger',
          success: '[&_[data-icon]]:text-brass',
        },
      }}
    />
  );
}
