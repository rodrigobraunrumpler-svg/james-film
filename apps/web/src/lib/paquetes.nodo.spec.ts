import { describe, expect, it } from 'vitest';
import type { PackageDto } from '@james-film/contracts';
import { desdeCuanto, enEscalera, masCaroDe, precio, soles } from './paquetes';

const p = (name: string, priceAmount: number | null): PackageDto =>
  ({ id: name, slug: name, name, priceAmount, currency: 'PEN', items: [] }) as unknown as PackageDto;

const BASICO = p('Basico', 30000);
const PRO = p('Pro', 60000);
const PREMIUM = p('Premium', 90000);
const MEDIDA = p('A medida', null);

describe('el orden de los paquetes', () => {
  it('sube por precio, que es lo que la escalera de acentos representa', () => {
    expect(enEscalera([PREMIUM, BASICO, PRO]).map((x) => x.name)).toEqual([
      'Basico',
      'Pro',
      'Premium',
    ]);
  });

  it('el que no tiene precio va AL FINAL, no al principio', () => {
    // El fallo real: `/fechas-libres` ordenaba con `?? 0` y lo mandaba al
    // primer puesto, así que los dos bloques de la MISMA página lo ponían en
    // extremos opuestos.
    expect(enEscalera([MEDIDA, PRO, BASICO]).map((x) => x.name)).toEqual([
      'Basico',
      'Pro',
      'A medida',
    ]);
  });

  it('no muta el array que recibe', () => {
    const original = [PREMIUM, BASICO];
    enEscalera(original);
    expect(original.map((x) => x.name)).toEqual(['Premium', 'Basico']);
  });
});

describe('el más caro', () => {
  it('sale del precio y no de la posición', () => {
    expect(masCaroDe([PREMIUM, BASICO, PRO])?.name).toBe('Premium');
  });

  it('ignora a los que no tienen precio', () => {
    expect(masCaroDe([MEDIDA, BASICO])?.name).toBe('Basico');
  });

  it('sin ninguno con precio, no hay más caro', () => {
    expect(masCaroDe([MEDIDA])).toBeNull();
  });
});

describe('el «desde» del hero', () => {
  it('es el más barato, formateado en soles y sin decimales', () => {
    expect(desdeCuanto([PREMIUM, BASICO, PRO])).toBe(precio(BASICO));
    expect(desdeCuanto([PREMIUM, BASICO, PRO])).toMatch(/^S\/\s?300$/);
  });

  it('SIN paquetes devuelve null, no «S/ ∞»', () => {
    // `Math.min(...[])` es Infinity: la guarda va antes de reducir.
    expect(desdeCuanto([])).toBeNull();
  });

  it('con ninguno con precio tampoco inventa un número', () => {
    expect(desdeCuanto([MEDIDA])).toBeNull();
  });
});


describe('el precio en soles', () => {
  it('un precio redondo se escribe entero, sin «.00»', () => {
    expect(soles(30000)).toMatch(/^S\/\s?300$/);
  });

  it('con céntimos se escriben los DOS decimales, no uno', () => {
    // Salía «S/ 300.5»: dinero con un decimal se lee como un fallo de la web
    // antes que como un precio.
    expect(soles(30050)).toMatch(/^S\/\s?300[.,]50$/);
    expect(soles(30005)).toMatch(/^S\/\s?300[.,]05$/);
  });

  it('no redondea los céntimos hacia arriba', () => {
    expect(soles(30099)).toMatch(/^S\/\s?300[.,]99$/);
  });
});
