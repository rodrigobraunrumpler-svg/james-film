import { describe, expect, it } from 'vitest';
import { monedaPartida } from './index';

describe('monedaPartida', () => {
  it('parte por el separador decimal', () => {
    expect(monedaPartida(30000)).toEqual({ entero: 'S/ 300', decimales: '.00' });
  });

  it('con miles parte por el ÚLTIMO separador, no por el primero', () => {
    // `S/ 1,300.00` tiene dos: partir por el primero daría «S/ 1» y «,300.00»,
    // que se leería como un precio diez veces menor.
    const { entero, decimales } = monedaPartida(130000);
    expect(entero).toMatch(/^S\/ 1[.,]300$/);
    expect(decimales).toMatch(/^[.,]00$/);
  });

  it('sin precio no inventa decimales', () => {
    expect(monedaPartida(null)).toEqual({ entero: '—', decimales: '' });
  });
});
