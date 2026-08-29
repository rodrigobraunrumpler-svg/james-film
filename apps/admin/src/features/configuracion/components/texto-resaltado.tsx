import type { ReactNode } from 'react';

/**
 * `aboutText` es Markdown y **solo usa negrita** (el resaltado dorado del
 * flyer). Se parte por `**` y se devuelven nodos React: las posiciones impares
 * son las resaltadas.
 *
 * No se instala un parser de Markdown para una sola marca, y sobre todo **no se
 * genera HTML**: un regex a `dangerouslySetInnerHTML` es una inyección
 * esperando su turno, y da igual que el texto lo escriba James — el mismo campo
 * se renderiza en la landing en build time.
 */
export function TextoResaltado({ texto }: { texto: string }): ReactNode {
  return texto.split('**').map((trozo, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold">
        {trozo}
      </strong>
    ) : (
      <span key={i}>{trozo}</span>
    ),
  );
}
