import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { degradadoDe, degradadoMedio, PALETA } from './degradado';

/** cuid reales: comparten prefijo y solo se distinguen por la cola. */
const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `cmex8q${String(i).padStart(4, '0')}k3p9`);

describe('degradado de portada', () => {
  it('los seis primeros son EXACTAMENTE los del prototipo', () => {
    // Se leen del propio mockup, no de una copia: si alguien retoca un tono
    // «para mejorarlo», el test lo dice. Son los colores que se aprobaron
    // mirándolos, y esa aprobación es el contrato.
    const mockup = readFileSync(
      new URL('../../../../docs/mockups-admin/Main.dc.html', import.meta.url),
      'utf8',
    );
    const enElPrototipo = [
      ...new Set(
        mockup.match(
          /radial-gradient\(120% 90% at \d+% \d+%, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 55%, #080706 100%\)/g,
        ) ?? [],
      ),
    ];

    expect(enElPrototipo).toHaveLength(6);
    expect(PALETA.delPrototipo).toEqual(enElPrototipo);
    expect(PALETA.todos.slice(0, 6)).toEqual(enElPrototipo);
  });

  it('los cuatro primeros de MEDIOS son los del prototipo del EDITOR', () => {
    // El editor usa otra receta que la lista —`110% 80% … 60%` frente a
    // `120% 90% … 55%`— porque su tesela es 3:4 y pequeña: el foco tiene que
    // ser más cerrado y caer antes. Confundir las dos listas es el fallo que
    // este test existe para impedir.
    const mockup = readFileSync(
      new URL('../../../../docs/mockups-admin/Editor.dc.html', import.meta.url),
      'utf8',
    );
    const enElPrototipo = [
      ...new Set(
        mockup.match(
          /radial-gradient\(110% 80% at \d+% \d+%, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 60%, #080706 100%\)/g,
        ) ?? [],
      ),
    ];

    expect(enElPrototipo).toHaveLength(4);
    expect(PALETA.medios.slice(0, 4)).toEqual(enElPrototipo);
  });

  it('las dos paletas no se pisan: geometrías distintas', () => {
    expect(PALETA.todos.every((g) => g.includes('120% 90%'))).toBe(true);
    expect(PALETA.medios.every((g) => g.includes('110% 80%'))).toBe(true);
    expect(PALETA.medios).toHaveLength(16);
  });

  it('un medio y su galería NO comparten degradado por accidente', () => {
    // `degradadoMedio` recibe el id del MEDIO, no el de la galería: si tomara
    // el de la galería, las ocho teselas de una boda saldrían del mismo color.
    const iguales = ids(8).map(degradadoMedio);
    expect(new Set(iguales).size).toBeGreaterThanOrEqual(6);
  });

  it('la extensión mantiene la receta: cae al `well` y no satura', () => {
    for (const g of PALETA.todos) {
      expect(g).toMatch(/^radial-gradient\(120% 90% at /);
      expect(g).toMatch(/#080706 100%\)$/);
    }
  });

  it('es estable: el mismo id da siempre el mismo color', () => {
    expect(degradadoDe('cmex8q0001k3p9')).toBe(degradadoDe('cmex8q0001k3p9'));
  });

  it('reparte entre ids que comparten prefijo, que es el caso real', () => {
    // Doce galerías creadas el mismo día no pueden salir en tres colores: el
    // degradado existe justo para separar esas.
    expect(new Set(ids(12).map(degradadoDe)).size).toBeGreaterThanOrEqual(8);
  });

  it('con una pantalla llena (20) usa casi toda la paleta', () => {
    expect(new Set(ids(20).map(degradadoDe)).size).toBeGreaterThanOrEqual(12);
  });

  it('hay dieciséis: con los seis del prototipo, nueve galerías ya repiten', () => {
    expect(PALETA.todos).toHaveLength(16);
  });
});
