import { describe, expect, it } from 'vitest';
import {
  cuantoFalta,
  diasEntre,
  hoyEnLima,
  masDias,
  masMeses,
  mesYAno,
  primeroDelMes,
  rango,
  rangoLargo,
  rejillaDelMes,
} from './fechas';

describe('hoyEnLima', () => {
  /**
   * El fallo que esto impide: el navegador de James está en Lima, pero un
   * despliegue o una prueba en otra zona movería el «hoy» del calendario un día
   * y con él la frontera de lo que se puede marcar.
   */
  it('a las 02:00 UTC sigue siendo el día ANTERIOR en Lima', () => {
    expect(hoyEnLima(new Date('2026-09-07T02:00:00.000Z'))).toBe('2026-09-06');
  });

  it('a las 20:00 de Lima sigue siendo HOY, no mañana', () => {
    // 20:00 en Lima = 01:00 UTC del día siguiente.
    expect(hoyEnLima(new Date('2026-09-07T01:00:00.000Z'))).toBe('2026-09-06');
  });
});

describe('masMeses', () => {
  it('no se desborda: 31 de enero más un mes es el 28, no el 3 de marzo', () => {
    expect(masMeses('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('en bisiesto cae en el 29', () => {
    expect(masMeses('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('hacia atrás también', () => {
    expect(masMeses('2026-03-31', -1)).toBe('2026-02-28');
    expect(masMeses('2026-01-15', -3)).toBe('2025-10-15');
  });
});

describe('rejillaDelMes', () => {
  it('empieza en LUNES', () => {
    // El 1 de setiembre de 2026 es martes: la rejilla arranca el lunes 31.
    expect(rejillaDelMes('2026-09-01')[0]).toEqual({ fecha: '2026-08-31', delMes: false });
  });

  it('son semanas enteras, y la sexta solo si hace falta', () => {
    for (const mes of ['2026-01-01', '2026-02-01', '2026-08-01', '2026-11-01']) {
      const celdas = rejillaDelMes(mes);
      expect(celdas.length % 7).toBe(0);
      expect([35, 42]).toContain(celdas.length);
    }
  });

  it('febrero de un año normal que empieza en lunes cabe en cuatro semanas… y aun así se pintan cinco', () => {
    // 2027-02-01 es lunes y el mes tiene 28 días: 28 celdas exactas, pero la
    // rejilla nunca baja de cinco semanas para no cambiar de alto al navegar.
    expect(rejillaDelMes('2027-02-01')).toHaveLength(35);
  });

  it('marca como fuera de mes solo el relleno', () => {
    const celdas = rejillaDelMes('2026-09-01');
    expect(celdas.filter((c) => c.delMes)).toHaveLength(30);
  });
});

describe('rango', () => {
  it('devuelve los extremos incluidos y en orden', () => {
    expect(rango('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('aguanta que lleguen del revés: se toca el último día primero a menudo', () => {
    expect(rango('2026-10-26', '2026-10-24')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('cruza el cambio de mes sin saltarse días', () => {
    expect(rango('2026-01-30', '2026-02-02')).toHaveLength(4);
  });
});

describe('rangoLargo', () => {
  it('un día suelto se dice entero', () => {
    expect(rangoLargo('2026-10-24', '2026-10-24')).toBe('24 de octubre');
  });

  // «24 y 25 de octubre», literal de la conversación que originó el módulo.
  it('dos días del mismo mes no repiten el mes', () => {
    expect(rangoLargo('2026-10-24', '2026-10-25')).toBe('24 y 25 de octubre');
  });

  it('a caballo entre dos meses sí lo dice dos veces', () => {
    expect(rangoLargo('2026-10-31', '2026-11-01')).toBe('31 de octubre – 1 de noviembre');
  });
});

describe('cuantoFalta', () => {
  it('distingue hoy, mañana y el resto', () => {
    expect(cuantoFalta('2026-09-06', '2026-09-06')).toBe('Es hoy');
    expect(cuantoFalta('2026-09-07', '2026-09-06')).toBe('Mañana');
    expect(cuantoFalta('2026-09-18', '2026-09-06')).toBe('Faltan 12 días');
  });

  it('y el pasado, que es donde vive el aviso de «grabaste y no publicaste»', () => {
    expect(cuantoFalta('2026-09-01', '2026-09-06')).toBe('Hace 5 días');
    expect(cuantoFalta('2026-09-05', '2026-09-06')).toBe('Hace 1 día');
  });
});

describe('lo demás', () => {
  it('diasEntre no se despeina en el cambio de mes ni de año', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2026-01-01', '2026-03-01')).toBe(59);
  });

  it('masDias cruza meses', () => {
    expect(masDias('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('primeroDelMes no depende de la zona del navegador', () => {
    expect(primeroDelMes('2026-09-30')).toBe('2026-09-01');
  });

  it('mesYAno formatea en UTC: en Lima un día 1 saldría como el mes anterior', () => {
    expect(mesYAno('2026-09-01')).toMatch(/setiembre|septiembre/i);
    expect(mesYAno('2026-09-01')).toContain('2026');
  });
});
