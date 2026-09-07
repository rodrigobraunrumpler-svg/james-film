import { describe, expect, it } from 'vitest';
import { fotosDe, piezas, piezasCorto, videosDe } from './piezas';

/** Lo mínimo para llamar a los helpers: el resto del DTO no lo miran. */
const g = (mediaCount: number, photoCount: number) => ({ mediaCount, photoCount });

describe('piezas', () => {
  it('una galería de solo vídeos dice reels', () => {
    expect(piezas(g(3, 0))).toBe('3 reels');
    expect(piezas(g(1, 0))).toBe('1 reel');
  });

  // El fallo que esto existe para impedir: la web decía «3 reels» de una
  // galería que son tres fotos, y eso es una cifra falsa en la portada.
  it('una galería de solo fotos dice FOTOS, nunca reels', () => {
    expect(piezas(g(3, 3))).toBe('3 fotos');
    expect(piezas(g(1, 1))).toBe('1 foto');
  });

  it('mezclada las dice las dos, vídeos primero', () => {
    expect(piezas(g(10, 8))).toBe('2 reels · 8 fotos');
  });

  it('vacía no dice nada: quien la pinta decide si esconde la línea', () => {
    expect(piezas(g(0, 0))).toBe('');
  });

  it('nunca cuenta vídeos negativos aunque los datos vengan torcidos', () => {
    expect(piezas(g(2, 5))).toBe('5 fotos');
  });
});

describe('piezasCorto', () => {
  it('manda lo que más hay', () => {
    expect(piezasCorto(g(10, 8))).toBe('8 fotos');
    expect(piezasCorto(g(10, 2))).toBe('8 reels');
  });

  it('con empate gana el reel: es el producto', () => {
    expect(piezasCorto(g(4, 2))).toBe('2 reels');
  });

  it('vacía no dice nada', () => {
    expect(piezasCorto(g(0, 0))).toBe('');
  });
});

describe('sumas de toda la web', () => {
  const todas = [g(5, 0), g(3, 3), g(10, 4)];

  it('«reels entregados» cuenta vídeos, no medios', () => {
    // 5 + 0 + 6. Con `mediaCount` daba 18 y contaba fotos como reels.
    expect(videosDe(todas)).toBe(11);
  });

  it('y las fotos se cuentan aparte', () => {
    expect(fotosDe(todas)).toBe(7);
  });
});
