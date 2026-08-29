import { describe, expect, it } from 'vitest';
import { limpiar, vacioANull } from './limpiar';

describe('vacioANull', () => {
  it('una cadena vacía se manda como null, para que la API la BORRE', () => {
    expect(vacioANull('')).toBeNull();
    expect(vacioANull('   ')).toBeNull();
  });

  it('recorta lo que sí tiene contenido', () => {
    expect(vacioANull('  Ayacucho  ')).toBe('Ayacucho');
  });

  it('null y undefined también salen como null', () => {
    expect(vacioANull(null)).toBeNull();
    expect(vacioANull(undefined)).toBeNull();
  });
});

describe('limpiar', () => {
  it('vacía las cadenas y deja el resto intacto', () => {
    expect(limpiar({ title: ' Boda ', description: '', location: '   ', categoryId: 'c1' })).toEqual(
      { title: 'Boda', description: null, location: null, categoryId: 'c1' },
    );
  });

  it('no toca lo que no es cadena: un 0 y un false son valores, no ausencias', () => {
    // Con una comprobación por veracidad, los tres se habrían perdido.
    expect(limpiar({ precio: 0, activo: false, ids: [] })).toEqual({
      precio: 0,
      activo: false,
      ids: [],
    });
  });

  it('conserva undefined, que significa «no toques este campo»', () => {
    expect(limpiar({ a: undefined, b: 'x' })).toEqual({ a: undefined, b: 'x' });
  });
});
