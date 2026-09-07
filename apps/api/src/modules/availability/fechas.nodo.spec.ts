import { describe, expect, it } from 'vitest';
import { aFechaUtc, aIsoDate, hoyEnLima, masMeses } from './fechas.js';

describe('hoyEnLima', () => {
  it('a las 20:00 de Lima sigue siendo HOY, no mañana', () => {
    // 2026-10-24 20:00 en Lima son las 01:00 UTC del 25. El contenedor corre en
    // UTC: sin el `timeZone` explícito, marcar «hoy» a esa hora daría 422 por
    // fecha pasada durante toda la tarde-noche.
    expect(hoyEnLima(new Date('2026-10-25T01:00:00.000Z'))).toBe('2026-10-24');
  });

  it('a mediodía coincide con el día UTC', () => {
    expect(hoyEnLima(new Date('2026-10-24T17:00:00.000Z'))).toBe('2026-10-24');
  });
});

describe('aIsoDate', () => {
  it('no resta cinco horas: una columna @db.Date es una fecha, no un instante', () => {
    // Formatearla en Lima devolvería el día anterior. Ya pasó con `eventDate`.
    expect(aIsoDate(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03-15');
  });

  it('va y vuelve', () => {
    expect(aIsoDate(aFechaUtc('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('masMeses', () => {
  it('no se desborda al último día del mes', () => {
    // `setUTCMonth` a secas da el 31 de febrero, que el motor convierte en el
    // 3 de marzo. Es el bug que la navegación mes a mes destapa.
    expect(masMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(masMeses('2026-03-31', 1)).toBe('2026-04-30');
    expect(masMeses('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('respeta el año bisiesto', () => {
    expect(masMeses('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('la ventana de doce meses cae en el mismo día', () => {
    expect(masMeses('2026-09-05', 12)).toBe('2027-09-05');
    expect(masMeses('2026-02-29', 12)).toBe('2027-02-28');
  });

  it('va hacia atrás también', () => {
    expect(masMeses('2026-03-31', -1)).toBe('2026-02-28');
  });
});
