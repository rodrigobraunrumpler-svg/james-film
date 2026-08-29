import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextoResaltado } from './texto-resaltado';

describe('TextoResaltado', () => {
  it('resalta lo que va entre asteriscos dobles', () => {
    render(
      <p>
        <TextoResaltado texto="Soy **James**, creador de contenido" />
      </p>,
    );

    expect(screen.getByText('James').tagName).toBe('STRONG');
    expect(screen.getByText(/creador de contenido/)).toBeInTheDocument();
  });

  it('NO genera HTML: una etiqueta escrita a mano sale como texto', () => {
    // Es la razón de existir de este componente: un regex a
    // dangerouslySetInnerHTML sería una inyección, y este mismo campo se
    // renderiza en la landing en build time.
    const { container } = render(
      <p>
        <TextoResaltado texto="Hola <img src=x onerror=alert(1)> mundo" />
      </p>,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
  });

  it('un asterisco suelto no rompe nada', () => {
    render(
      <p>
        <TextoResaltado texto="2 ** 3 sin cerrar" />
      </p>,
    );
    expect(screen.getByText(/sin cerrar/)).toBeInTheDocument();
  });

  it('un texto vacío no revienta', () => {
    const { container } = render(
      <p>
        <TextoResaltado texto="" />
      </p>,
    );
    expect(container.textContent).toBe('');
  });
});
