import { describe, expect, it } from 'vitest';
import {
  aIso,
  corto,
  duracion,
  hoy,
  INICIALES_SEMANA,
  largo,
  masDias,
  masMeses,
  sabadosLibres,
  mesYAno,
  rango,
  rejillaDelMes,
  relativo,
} from './fechas';

describe('hoy en Lima', () => {
  it('a las 20:00 de Lima sigue siendo HOY, no mañana', () => {
    // Perú es UTC−5: las 20:00 del 24 en Lima son las 01:00 del 25 en UTC.
    // Sin `timeZone` explícito, el build —que corre en UTC— adelantaría el día.
    // Es el mismo fallo que ya se encontró en la serie de clics del panel.
    expect(hoy(new Date('2026-10-25T01:00:00Z'))).toBe('2026-10-24');
  });

  it('a las 19:00 de Lima, tampoco', () => {
    expect(hoy(new Date('2026-10-25T00:00:00Z'))).toBe('2026-10-24');
  });

  it('a la medianoche de Lima ya es el día siguiente', () => {
    expect(hoy(new Date('2026-10-25T05:00:00Z'))).toBe('2026-10-25');
  });
});

describe('formato', () => {
  it('una fecha de calendario NO se corre un día al formatearla', () => {
    // Formatearla en Lima restaría 5 horas y diría «23 de octubre».
    expect(largo('2026-10-24')).toContain('24');
    expect(corto('2026-10-24')).toContain('24');
    expect(largo('2026-10-24')).toContain('sábado');
  });

  it('la cabecera del mes es una etiqueta, no una frase: sin «de»', () => {
    // `Intl` en español devuelve «octubre de 2026». En una cabecera sobra.
    expect(mesYAno('2026-10-01')).toBe('Octubre 2026');
  });

  it('el día largo va sin la coma de Intl: acaba dentro de una frase', () => {
    expect(largo('2026-10-24')).toBe('sábado 24 de octubre');
  });
});

describe('rango', () => {
  it('un solo día no dice «del … al …»', () => {
    expect(rango('2026-10-24', '2026-10-24')).toMatch(/^el sábado 24/);
  });

  it('dos días del mismo mes no repiten el mes', () => {
    // Es como lo pidió la clienta de la conversación real: «24 y 25 de octubre».
    expect(rango('2026-10-24', '2026-10-25')).toBe('del 24 al 25 de octubre');
  });

  it('a caballo entre dos meses, los nombra los dos', () => {
    expect(rango('2026-10-30', '2026-11-02')).toBe('del 30 de octubre al 2 de noviembre');
  });
});

describe('aritmética', () => {
  it('cruzar el fin de mes y el de año', () => {
    expect(masDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(masDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('doce meses es la ventana del calendario', () => {
    expect(masMeses('2026-10-24', 12)).toBe('2027-10-24');
  });

  it('el 31 en un mes de 30 cae al último día, no se desborda a otro mes', () => {
    expect(masMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(masMeses('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('el orden alfabético ES el cronológico: por eso no hace falta librería', () => {
    const desordenadas = ['2026-10-24', '2026-01-05', '2026-10-03', '2025-12-31'];
    expect([...desordenadas].sort()).toEqual([
      '2025-12-31',
      '2026-01-05',
      '2026-10-03',
      '2026-10-24',
    ]);
  });
});

describe('rejilla del mes', () => {
  it('empieza en LUNES, no en domingo', () => {
    // `es-PE` empieza la semana en lunes. Con `getUTCDay()` a pelo, octubre de
    // 2026 —que empieza en jueves— saldría desplazado un día entero.
    expect(INICIALES_SEMANA).toHaveLength(7);
    const rejilla = rejillaDelMes('2026-10-01');
    const primerDiaDelMes = rejilla.findIndex((c) => c.dia === '2026-10-01');
    // 1-oct-2026 es jueves → tres huecos delante (L, M, X).
    expect(primerDiaDelMes).toBe(3);
  });

  it('siempre 42 celdas: seis filas completas, sin saltos de alto', () => {
    for (const mes of ['2026-01-01', '2026-02-01', '2026-08-01', '2026-11-01']) {
      expect(rejillaDelMes(mes)).toHaveLength(42);
    }
  });

  it('marca qué celdas son del mes y cuáles son relleno', () => {
    const rejilla = rejillaDelMes('2026-10-01');
    expect(rejilla.filter((c) => c.delMes)).toHaveLength(31);
    expect(rejilla[0]!.delMes).toBe(false);
  });

  it('febrero de un año bisiesto tiene 29', () => {
    expect(rejillaDelMes('2028-02-01').filter((c) => c.delMes)).toHaveLength(29);
  });
});

describe('relativo', () => {
  it('usa las palabras naturales, no «hace 2 días»', () => {
    // `numeric: 'auto'` dice «anteayer» y «ayer» en vez de contar. Es lo que
    // diría una persona, y para «actualizado hace…» eso es lo que se quiere.
    const ahora = new Date('2026-10-24T12:00:00Z').getTime();
    expect(relativo('2026-10-22T12:00:00Z', ahora)).toBe('anteayer');
    expect(relativo('2026-10-23T12:00:00Z', ahora)).toBe('ayer');
    expect(relativo('2026-10-19T12:00:00Z', ahora)).toContain('5');
  });

  it('menos de un minuto no dice «hace 0 segundos»', () => {
    const ahora = new Date('2026-10-24T12:00:00Z').getTime();
    expect(relativo('2026-10-24T11:59:40Z', ahora)).toBe('hace un momento');
  });
});

describe('aIso', () => {
  it('lee la fecha en UTC, no en la zona del proceso', () => {
    expect(aIso(new Date('2026-10-24T00:00:00Z'))).toBe('2026-10-24');
  });
});

describe('duracion', () => {
  it('formatea en m:ss sin cero a la izquierda en el minuto', () => {
    expect(duracion(42)).toBe('0:42');
    expect(duracion(72)).toBe('1:12');
    expect(duracion(124)).toBe('2:04');
  });

  it('redondea a segundos enteros', () => {
    expect(duracion(41.6)).toBe('0:42');
  });

  it('devuelve null cuando no hay dato, y no «0:00»', () => {
    // Un «0:00» dice «dura cero», que es otra cosa que «no se pudo medir».
    expect(duracion(null)).toBeNull();
    expect(duracion(Number.NaN)).toBeNull();
    expect(duracion(-1)).toBeNull();
  });
});

describe('sabadosLibres', () => {
  const HASTA = '2027-10-01';

  it('no dice nada si el mes está entero libre', () => {
    // «Quedan 4 sábados libres» no da urgencia: da la contraria. Y es lo que
    // vería el visitante el primer día, con la tabla vacía.
    expect(sabadosLibres([], HASTA, '2026-10-01')).toBeNull();
  });

  it('cuenta solo desde hoy y solo si hay algún sábado tomado', () => {
    // Octubre 2026: sábados 3, 10, 17, 24, 31.
    const r = sabadosLibres(['2026-10-10'], HASTA, '2026-10-01');
    expect(r?.texto).toBe('quedan 4 sábados libres en octubre');
  });

  it('los sábados ya pasados de este mes no cuentan', () => {
    const r = sabadosLibres(['2026-10-10'], HASTA, '2026-10-12');
    // Quedan el 17, el 24 y el 31; el 10 ya pasó y además estaba ocupado.
    expect(r).toBeNull();
  });

  it('singular cuando queda uno', () => {
    const r = sabadosLibres(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'], HASTA, '2026-10-01');
    expect(r?.texto).toBe('quedan 1 sábado libre en octubre');
  });

  it('con todos ocupados no dice nada: no hay nada que ofrecer', () => {
    const todos = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'];
    expect(sabadosLibres(todos, HASTA, '2026-10-01')).toBeNull();
  });

  it('lo que cae más allá de `until` no se cuenta: no se sabe', () => {
    // Con el dato acabando el 15, solo entran los sábados 3 y 10.
    const r = sabadosLibres(['2026-10-03'], '2026-10-15', '2026-10-01');
    expect(r?.texto).toBe('quedan 1 sábado libre en octubre');
  });
});
