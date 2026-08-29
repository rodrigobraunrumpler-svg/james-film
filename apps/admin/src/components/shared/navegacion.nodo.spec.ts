import { describe, expect, it } from 'vitest';
import { esActivo } from './navegacion';

describe('qué entrada del menú se marca', () => {
  it('el editor de una galería marca «Galerías»', () => {
    // La lista vive en `/` y el editor en `/galerias/[id]`: con igualdad exacta
    // el menú se quedaba sin nada marcado justo donde James pasa el rato.
    expect(esActivo('/galerias/cmte5vffz0007', '/')).toBe(true);
    expect(esActivo('/', '/')).toBe(true);
  });

  it('estando en el editor, NINGUNA otra entrada se marca', () => {
    for (const otra of ['/categorias', '/paquetes', '/testimonios', '/configuracion']) {
      expect(esActivo('/galerias/cmte5vffz0007', otra)).toBe(false);
    }
  });

  it('«Galerías» no se marca desde otra pantalla', () => {
    for (const ruta of ['/categorias', '/paquetes', '/testimonios', '/configuracion']) {
      expect(esActivo(ruta, '/')).toBe(false);
    }
  });

  it('el prefijo exige la barra: /paquetesx no es /paquetes', () => {
    expect(esActivo('/paquetes/nuevo', '/paquetes')).toBe(true);
    expect(esActivo('/paquetesx', '/paquetes')).toBe(false);
  });
});
