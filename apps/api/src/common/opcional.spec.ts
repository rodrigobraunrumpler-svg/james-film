import { describe, expect, it } from 'vitest';
import { fechaDeCalendario, mapear, textoLimpio } from './opcional.js';

describe('mapear', () => {
  it('undefined se queda en undefined: Prisma lo lee como «no tocar»', () => {
    expect(mapear(undefined, (v: string) => v.trim())).toBeUndefined();
  });

  it('null se queda en null: Prisma lo lee como «borra»', () => {
    // Es el caso que se perdía. `dto.campo?.trim()` devuelve undefined aquí,
    // convirtiendo «bórralo» en «déjalo como está».
    expect(mapear(null, (v: string) => v.trim())).toBeNull();
  });

  it('no llama a la transformación con null ni con undefined', () => {
    // Si la llamara, `(v) => v.trim()` reventaría en vez de devolver null.
    expect(() => mapear<string, string>(null, (v) => v.trim())).not.toThrow();
    expect(() => mapear<string, string>(undefined, (v) => v.trim())).not.toThrow();
  });

  it('transforma cuando hay valor', () => {
    expect(mapear('  hola  ', (v: string) => v.trim())).toBe('hola');
  });

  it('un 0 y una cadena vacía SÍ se transforman: son valores, no ausencias', () => {
    // El bug original venía de usar la veracidad (`v ? … : …`) en vez de la
    // presencia, y ahí un 0 legítimo se comporta como un campo ausente.
    expect(mapear(0, (v: number) => v + 1)).toBe(1);
    expect(mapear('', (v: string) => v.length)).toBe(0);
  });
});

describe('fechaDeCalendario', () => {
  it('convierte a medianoche UTC, sin desfase de día', () => {
    expect(fechaDeCalendario('2026-03-15')?.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('null borra, undefined no toca', () => {
    expect(fechaDeCalendario(null)).toBeNull();
    expect(fechaDeCalendario(undefined)).toBeUndefined();
  });
});

describe('textoLimpio', () => {
  it('recorta', () => {
    expect(textoLimpio('  Ayacucho  ')).toBe('Ayacucho');
  });

  it('una cadena que queda vacía se guarda como null, no como ""', () => {
    // Dos representaciones de «vacío» sobre la misma columna dejarían fuera de
    // cualquier filtro por null a las que quedaron en cadena vacía.
    expect(textoLimpio('   ')).toBeNull();
    expect(textoLimpio('')).toBeNull();
  });

  it('null borra, undefined no toca', () => {
    expect(textoLimpio(null)).toBeNull();
    expect(textoLimpio(undefined)).toBeUndefined();
  });
});
