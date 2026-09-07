import { describe, expect, it } from 'vitest';
import { enlace, mensaje } from './whatsapp';

const BASE = 'Hola James, me interesa contratar tus servicios';
const numero = '51994724944';

describe('el mensaje de WhatsApp', () => {
  it('sin fecha, es EXACTAMENTE el que James escribió en Configuración', () => {
    // La web no reescribe su texto. Si lo hiciera, el botón de «Probar este
    // número» del admin —que abre WhatsApp con este mismo base— pasaría a
    // mentir sobre lo que va a recibir la clienta.
    expect(mensaje({ numero, base: BASE })).toBe(BASE);
  });

  /**
   * DOS LÍNEAS, y cada una para un lector: arriba la frase de James —que es la
   * voz con la que el cliente lo manda— y abajo el dato, siempre en el mismo
   * sitio, para que James lo encuentre sin leer entre otros veinte mensajes.
   */
  it('la fecha va en su PROPIA línea, detrás del base intacto', () => {
    const m = mensaje({ numero, base: BASE, desde: '2026-10-24' });
    const [primera, blanca, segunda] = m.split('\n');
    expect(primera).toBe(`${BASE}.`);
    expect(blanca).toBe('');
    expect(segunda).toBe('sábado 24 de octubre. ¿Lo tienes libre?');
  });

  it('el salto es DOBLE: con uno, WhatsApp lo junta y vuelve a ser un párrafo', () => {
    expect(mensaje({ numero, base: BASE, desde: '2026-10-24' })).toContain('\n\n');
  });

  /**
   * Sin negrita a propósito. WhatsApp no formatea hasta que el mensaje se
   * ENVÍA, así que el cliente vería los asteriscos crudos justo cuando decide
   * si lo manda — y un mensaje que parece roto ahí cuesta el clic.
   */
  it('no lleva asteriscos: el cliente los vería crudos antes de enviar', () => {
    expect(mensaje({ numero, base: BASE, desde: '2026-10-24' })).not.toContain('*');
  });

  /**
   * NI UN CARÁCTER FUERA DE LATIN-1 en lo que pone el código.
   *
   * Llevaba un 📅 de ancla y en un WhatsApp sin fuente de emoji se pintaba como
   * `�` en el cuadro de texto — o sea justo donde el cliente decide si envía.
   * Es el mismo fallo que el de los asteriscos, con otra causa. Se comprueba
   * sobre la línea que ESCRIBE el código (base vacío): lo que James teclee en
   * Configuración es suyo y no lo podemos gobernar desde aquí.
   */
  it('lo que añade el código es todo Latin-1: nada que un móvil pueda no tener', () => {
    for (const caso of [
      { desde: '2026-10-24' },
      { desde: '2026-10-24', hasta: '2026-10-25' },
      { desde: '2026-10-10', ocupado: true },
    ]) {
      const linea = mensaje({ numero, base: '', ...caso });
      // Se busca lo que ESTÁ por encima de Latin-1, en vez de negar un rango
      // que empieza en cero: negándolo, la clase incluye los caracteres de
      // control y el linter avisa con razón. Con el flag `u`, el rango llega
      // hasta el último plano, así que un emoji cae dentro entero.
      const malos = linea.match(/[\u0100-\u{10ffff}]/gu) ?? [];
      expect(malos, `caracteres de riesgo en «${linea}»: ${malos.join(' ')}`).toEqual([]);
    }
  });

  it('con dos días, dice el rango como lo pidió la clienta real', () => {
    // «Quiero para dos días — 24 y 25 de octubre», de la conversación que
    // originó el módulo. Y el plural: «¿Los tienes libres?».
    expect(mensaje({ numero, base: BASE, desde: '2026-10-24', hasta: '2026-10-25' })).toContain(
      'del 24 al 25 de octubre. ¿Los tienes libres?',
    );
  });

  it('un rango de un solo día no dice «del 24 al 24»', () => {
    expect(mensaje({ numero, base: BASE, desde: '2026-10-24', hasta: '2026-10-24' })).toContain(
      'sábado 24 de octubre. ¿Lo tienes libre?',
    );
  });

  it('un día ocupado NO es un callejón: pregunta por otra fecha', () => {
    const m = mensaje({ numero, base: BASE, desde: '2026-10-10', ocupado: true });
    expect(m).toContain('Vi que está ocupado');
    expect(m).toContain('¿tienes otra fecha por esas semanas?');
    // Y la fecha sigue estando, que es lo que James necesita para proponer otra.
    expect(m).toContain('sábado 10 de octubre');
  });

  it('con el base vacío, la línea de la fecha ES el mensaje, sin salto suelto', () => {
    // Nunca se abre WhatsApp con el cuadro en blanco — ni con un salto delante.
    const m = mensaje({ numero, base: '   ', desde: '2026-10-24' });
    expect(m).toBe('sábado 24 de octubre. ¿Lo tienes libre?');
  });

  it('el base del PAQUETE también sobrevive entero: paquete arriba, fecha abajo', () => {
    const m = mensaje({
      numero,
      base: 'Hola James, me interesa el paquete Pro para mi evento',
      desde: '2026-09-23',
    });
    expect(m).toBe(
      'Hola James, me interesa el paquete Pro para mi evento.\n\nmiércoles 23 de setiembre. ¿Lo tienes libre?',
    );
  });
});

describe('el enlace', () => {
  it('va a wa.me con el número sin «+» y el texto codificado', () => {
    const url = enlace({ numero, base: BASE, desde: '2026-10-24' });
    expect(url.startsWith('https://wa.me/51994724944?text=')).toBe(true);
    // Sin codificar, el «?» de la pregunta cortaría el query string.
    expect(url).not.toContain(' ');
    // Y el salto viaja como %0A: si se colara crudo, la URL se partiría.
    expect(url).toContain('%0A%0A');
    expect(decodeURIComponent(url.split('?text=')[1]!)).toContain('¿Lo tienes libre?');
  });
});

describe('la costura entre el texto de James y el contexto', () => {
  it('puntúa cuando el base no acaba en punto', () => {
    // Salía «…tus servicios Vi que el sábado 5 está ocupado»: dos frases
    // pegadas. El punto lo pone el código; ni una palabra del base cambia.
    expect(mensaje({ numero: '51999', base: 'Hola, me interesa', desde: '2026-10-24' })).toBe(
      'Hola, me interesa.\n\nsábado 24 de octubre. ¿Lo tienes libre?',
    );
  });

  it('no añade un segundo punto si ya lo trae', () => {
    expect(mensaje({ numero: '51999', base: 'Hola.', desde: '2026-10-24' })).toBe(
      'Hola.\n\nsábado 24 de octubre. ¿Lo tienes libre?',
    );
    expect(mensaje({ numero: '51999', base: '¿Hablamos?', desde: '2026-10-24' })).toMatch(
      /^¿Hablamos\?\n\nsábado/,
    );
  });

  it('sin contexto, el base sobrevive entero y sin tocar', () => {
    expect(mensaje({ numero: '51999', base: 'Hola, me interesa' })).toBe('Hola, me interesa');
  });
});
