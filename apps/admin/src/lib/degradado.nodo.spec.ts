import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { degradadoDe, degradadoMedio, PALETA } from './degradado';

/**
 * Las dos funciones devuelven el PAR de variables, no una cadena. Los tests de
 * reparto tienen que comparar el VALOR: con los objetos, `new Set` cuenta
 * referencias distintas y todo pasaría siempre, incluida una paleta de un solo
 * color.
 */
const oscuro = (id: string) => degradadoDe(id)['--deg-oscuro' as never] as unknown as string;
const oscuroMedio = (id: string) =>
  degradadoMedio(id)['--deg-oscuro' as never] as unknown as string;
const claro = (id: string) => degradadoDe(id)['--deg-claro' as never] as unknown as string;

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
    const iguales = ids(8).map(oscuroMedio);
    expect(new Set(iguales).size).toBeGreaterThanOrEqual(6);
  });

  it('la extensión mantiene la receta: cae al `well` y no satura', () => {
    for (const g of PALETA.todos) {
      expect(g).toMatch(/^radial-gradient\(120% 90% at /);
      expect(g).toMatch(/#080706 100%\)$/);
    }
  });

  it('es estable: el mismo id da siempre el mismo color', () => {
    expect(oscuro('cmex8q0001k3p9')).toBe(oscuro('cmex8q0001k3p9'));
    expect(claro('cmex8q0001k3p9')).toBe(claro('cmex8q0001k3p9'));
  });

  it('reparte entre ids que comparten prefijo, que es el caso real', () => {
    // Doce galerías creadas el mismo día no pueden salir en tres colores: el
    // degradado existe justo para separar esas.
    expect(new Set(ids(12).map(oscuro)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(ids(12).map(claro)).size).toBeGreaterThanOrEqual(8);
  });

  it('con una pantalla llena (20) usa casi toda la paleta', () => {
    expect(new Set(ids(20).map(oscuro)).size).toBeGreaterThanOrEqual(12);
  });

  it('hay dieciséis: con los seis del prototipo, nueve galerías ya repiten', () => {
    expect(PALETA.todos).toHaveLength(16);
  });

  it('la paleta clara está ALINEADA por índice con la oscura', () => {
    // Si midieran distinto, la misma galería cambiaría de sitio en la serie al
    // cambiar de tema: el color dejaría de ser un identificador estable, que es
    // lo único para lo que existe.
    expect(PALETA.claros).toHaveLength(PALETA.todos.length);
    expect(PALETA.mediosClaros).toHaveLength(PALETA.medios.length);

    const id = 'cmex8q0007k3p9';
    const i = PALETA.todos.indexOf(oscuro(id) as (typeof PALETA.todos)[number]);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(claro(id)).toBe(PALETA.claros[i]);
  });

  it('los seis primeros claros son los del prototipo CLARO', () => {
    const mockup = readFileSync(
      new URL('../../../../docs/mockups-admin/v3-claro/Galerias.dc.html', import.meta.url),
      'utf8',
    );
    const enElPrototipo = [
      ...new Set(mockup.match(/radial-gradient\(at [^;"]*?#[0-9A-F]{6};/g) ?? []),
    ].map((g) => g.slice(0, -1));

    expect(enElPrototipo).toHaveLength(6);
    // El código los escribe con espacio tras la coma (Prettier); el prototipo
    // no. Se comparan sin espacios, que es lo que el navegador ve igual.
    const sinEspacios = (g: string) => g.replace(/,\s+/g, ',');
    expect(PALETA.claros.slice(0, 6).map(sinEspacios)).toEqual(enElPrototipo.map(sinEspacios));
  });

  it('la paleta clara es CLARA de verdad: nada por debajo del 85% de luz', () => {
    // Un tono medio colado aquí no rompe nada visible en una captura, pero deja
    // el chip blanco de «24 medios» ilegible justo encima.
    for (const g of [...PALETA.claros, ...PALETA.mediosClaros]) {
      for (const hex of g.match(/#[0-9A-F]{6}/g) ?? []) {
        const [r, v, a] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect((0.2126 * r! + 0.7152 * v! + 0.0722 * a!) / 255).toBeGreaterThan(0.85);
      }
    }
  });
});
