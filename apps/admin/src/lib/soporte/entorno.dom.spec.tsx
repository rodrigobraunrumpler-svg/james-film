import { render, screen } from '@testing-library/react';

/**
 * Guardia del andamiaje del proyecto `dom`, y documentación ejecutable de sus
 * LÍMITES: happy-dom no decodifica vídeo ni rasteriza canvas. Si algún día
 * empezara a hacerlo, este test falla y nos enteramos.
 */
describe('proyecto dom', () => {
  it('renderiza React y jest-dom está enchufado', () => {
    render(<p>XV de Camila</p>);
    expect(screen.getByText('XV de Camila')).toBeInTheDocument();
  });

  it('happy-dom NO decodifica vídeo: por eso extraerPoster se prueba en Playwright', () => {
    const v = document.createElement('video');
    // Ni siquiera implementa la propiedad: es `undefined`, no 0. Un test de poster
    // aquí pasaría sin comprobar nada, que es peor que no tenerlo. La capa de
    // decodificación real va a Playwright (Task 8) y al iPhone.
    expect(v.videoWidth).toBeUndefined();
  });
});
