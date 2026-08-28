/**
 * Guardia del andamiaje: fija qué se puede afirmar en el proyecto `nodo`.
 * Si alguien cambia el entorno, esto lo dice antes que un test de negocio
 * fallando por una razón que no tiene nada que ver.
 */
describe('proyecto nodo', () => {
  it('Blob y File son globales en Node 24: la lógica de bytes no necesita DOM', () => {
    const f = new File([new Uint8Array([1, 2, 3])], 'reel.mp4', { type: 'video/mp4' });
    expect(f.size).toBe(3);
    expect(typeof f.slice).toBe('function');
  });

  it('no hay document: si un test lo necesita, va en el proyecto dom', () => {
    expect(typeof globalThis.document).toBe('undefined');
  });
});
