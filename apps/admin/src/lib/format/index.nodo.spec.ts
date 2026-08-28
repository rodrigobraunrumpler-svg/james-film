import { describe, expect, it } from 'vitest';
import { fecha, fechaHora, moneda, relativo, tamano } from './index';

describe('formato', () => {
  it('una fecha de calendario se formatea en UTC, no en Lima', () => {
    // El bug clásico: `2026-03-15` en Lima (UTC-5) mostraría el 14 de marzo.
    expect(fecha('2026-03-15')).toBe('15 de marzo de 2026');
    expect(fecha(null)).toBe('—');
  });

  it('un instante SÍ se formatea en Lima: es cuando ocurrió para James', () => {
    // 2026-08-28T16:00Z son las 11:00 en Ayacucho.
    expect(fechaHora('2026-08-28T16:00:00.000Z')).toContain('11:00');
  });

  it('los tiempos relativos salen en castellano', () => {
    const ahora = new Date('2026-08-28T16:00:00Z').getTime();
    expect(relativo('2026-08-28T15:56:00Z', ahora)).toBe('hace 4 minutos');
    expect(relativo('2026-08-28T14:00:00Z', ahora)).toBe('hace 2 horas');
    expect(relativo('2026-08-25T10:00:00Z', ahora)).toBe('hace 3 días');
  });

  it('el precio sale de céntimos, nunca de un float', () => {
    expect(moneda(30_000)).toBe('S/ 300.00');
    expect(moneda(null)).toBe('—');
  });

  it('los tamaños se leen sin contar ceros', () => {
    expect(tamano(35 * 1024 * 1024)).toBe('35 MB');
    expect(tamano(230 * 1024 * 1024)).toBe('230 MB');
    expect(tamano(512)).toBe('512 B');
  });
});
