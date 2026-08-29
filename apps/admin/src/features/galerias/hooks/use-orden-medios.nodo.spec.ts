import { describe, expect, it } from 'vitest';
import { mover } from './use-orden-medios';

describe('mover', () => {
  const lista = ['a', 'b', 'c', 'd'];

  it('mueve hacia atrás', () => {
    expect(mover(lista, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('mueve hacia delante', () => {
    expect(mover(lista, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('no muta el original', () => {
    mover(lista, 0, 3);
    expect(lista).toEqual(['a', 'b', 'c', 'd']);
  });

  it('devuelve la misma lista si el movimiento no cambia nada', () => {
    expect(mover(lista, 1, 1)).toBe(lista);
  });

  it('un índice fuera de rango no rompe ni pierde elementos', () => {
    expect(mover(lista, 0, 9)).toEqual(lista);
    expect(mover(lista, -1, 2)).toEqual(lista);
  });
});
