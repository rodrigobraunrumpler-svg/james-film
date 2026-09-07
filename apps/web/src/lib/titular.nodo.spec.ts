import { describe, expect, it } from 'vitest';
import { partirTitular } from './titular';

describe('el latón del titular', () => {
  it('el de hoy sigue dando exactamente lo mismo', () => {
    // Si esto cambia, el hero cambia sin que nadie lo haya pedido.
    expect(partirTitular('Transformo momentos en historias')).toEqual({
      inicio: 'Transformo momentos en ',
      final: 'historias',
    });
  });

  it('arrastra el número: «48 horas», no «horas» a secas', () => {
    // El fallo que este módulo existe para impedir: resaltar «horas» y dejar
    // apagado el 48, que es el número que hace el titular.
    expect(partirTitular('Reels de tu evento, en 48 horas')).toEqual({
      inicio: 'Reels de tu evento, en ',
      final: '48 horas',
    });
  });

  it('una sola palabra va entera en latón y sin inicio', () => {
    expect(partirTitular('Historias')).toEqual({ inicio: '', final: 'Historias' });
  });

  it('no se lía con los espacios de más ni con los saltos', () => {
    expect(partirTitular('  Tu evento   en reels  ')).toEqual({
      inicio: 'Tu evento en ',
      final: 'reels',
    });
  });

  it('un número que NO va delante de la última palabra no se arrastra', () => {
    expect(partirTitular('4 reels para tu evento')).toEqual({
      inicio: '4 reels para tu ',
      final: 'evento',
    });
  });

  it('«2 días» al final se lleva los dos', () => {
    expect(partirTitular('Tu boda en 2 días')).toEqual({ inicio: 'Tu boda en ', final: '2 días' });
  });
});
