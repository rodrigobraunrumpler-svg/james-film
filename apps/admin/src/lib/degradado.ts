import type { CSSProperties } from 'react';

/**
 * Una galería sin portada no debe ser un rectángulo negro: con seis eventos
 * seguidos sin miniatura, James no distingue uno de otro. Cada galería recibe
 * un degradado propio y ESTABLE —derivado de su id, no aleatorio— así que el
 * color es un identificador más, como el título.
 *
 * También se pinta DEBAJO de la portada real: mientras la imagen carga se ve
 * esto y no un hueco, y el color no salta cuando entra.
 *
 * Todos oscuros y todos cayendo al `well`: van DEBAJO de una foto, no al lado.
 * Un tono saturado le pelearía la atención a la portada, que es lo único que
 * de verdad importa en esta pantalla.
 */
/**
 * LOS SEIS PRIMEROS SON LOS DEL PROTOTIPO, copiados carácter a carácter de
 * `docs/mockups-admin/Main.dc.html`. No se retocan: son los que se aprobaron
 * mirándolos. Hay un test que los compara con esta lista.
 */
const DEL_PROTOTIPO = [
  'radial-gradient(120% 90% at 30% 25%, #4A3A28 0%, #1C1512 55%, #080706 100%)',
  'radial-gradient(120% 90% at 65% 30%, #3A3140 0%, #191418 55%, #080706 100%)',
  'radial-gradient(120% 90% at 45% 60%, #2E3A33 0%, #141A17 55%, #080706 100%)',
  'radial-gradient(120% 90% at 55% 35%, #453322 0%, #1B1410 55%, #080706 100%)',
  'radial-gradient(120% 90% at 40% 40%, #3F2B2B 0%, #1A1212 55%, #080706 100%)',
  'radial-gradient(120% 90% at 60% 50%, #2B3340 0%, #12161A 55%, #080706 100%)',
] as const;

/**
 * Diez más, construidos con la MISMA receta que los seis de arriba —misma
 * luminosidad (21%), misma saturación baja, mismo `55%` de caída al `well`— y
 * en los tonos que el prototipo deja libres: óxido, bronce, oliva, musgo,
 * petróleo, acero, índigo, malva, ciruela y granate rosado.
 *
 * No son un capricho: el prototipo tiene seis tarjetas y James ya tiene nueve
 * galerías. Con solo seis, tres salen repetidas en la primera pantalla.
 */
const EXTENSION = [
  'radial-gradient(120% 90% at 62% 32%, #432F28 0%, #1D1411 55%, #080706 100%)',
  'radial-gradient(120% 90% at 35% 52%, #464325 0%, #1E1D10 55%, #080706 100%)',
  'radial-gradient(120% 90% at 70% 40%, #3A4229 0%, #191C11 55%, #080706 100%)',
  'radial-gradient(120% 90% at 28% 38%, #2E402B 0%, #141C12 55%, #080706 100%)',
  'radial-gradient(120% 90% at 52% 62%, #29423E 0%, #111C1B 55%, #080706 100%)',
  'radial-gradient(120% 90% at 38% 28%, #293C42 0%, #111A1C 55%, #080706 100%)',
  'radial-gradient(120% 90% at 66% 55%, #2A2A41 0%, #12121C 55%, #080706 100%)',
  'radial-gradient(120% 90% at 30% 60%, #3F2C3F 0%, #1B131B 55%, #080706 100%)',
  'radial-gradient(120% 90% at 58% 25%, #412A39 0%, #1C1219 55%, #080706 100%)',
  'radial-gradient(120% 90% at 45% 45%, #402B32 0%, #1C1215 55%, #080706 100%)',
] as const;

const DEGRADADOS = [...DEL_PROTOTIPO, ...EXTENSION] as const;

/**
 * LA PALETA CLARA. Los seis primeros salen carácter a carácter de
 * `docs/mockups-admin/v3-claro/Galerias.dc.html`; los diez siguientes reusan su
 * receta —tres manchas suaves sobre una base, todas por encima del 90% de
 * luminosidad— en los mismos tonos que la extensión oscura.
 *
 * No es la paleta oscura aclarada: invertir un degradado pensado para ir debajo
 * de una foto da grises sucios. Van ALINEADOS POR ÍNDICE con `DEGRADADOS`, así
 * que una galería conserva su sitio en la serie al cambiar de tema —cambia el
 * tono, no la identidad—. Hay test de que las dos listas miden lo mismo.
 */
const DEGRADADOS_CLAROS = [
  'radial-gradient(at 24% 20%, #F8EADF 0, transparent 55%), radial-gradient(at 76% 28%, #F0DCE3 0, transparent 52%), radial-gradient(at 48% 88%, #E7DAD0 0, transparent 60%), #F2E9E2',
  'radial-gradient(at 26% 22%, #E5EAF6 0, transparent 55%), radial-gradient(at 78% 26%, #EFE5F4 0, transparent 50%), radial-gradient(at 44% 86%, #DCE2EE 0, transparent 60%), #E8ECF4',
  'radial-gradient(at 22% 24%, #FBF3DD 0, transparent 55%), radial-gradient(at 74% 22%, #F7E9D5 0, transparent 50%), radial-gradient(at 56% 84%, #EEE5CC 0, transparent 60%), #F6F0DF',
  'radial-gradient(at 28% 18%, #E9F1EA 0, transparent 55%), radial-gradient(at 72% 30%, #DEEEEC 0, transparent 50%), radial-gradient(at 50% 86%, #D8E7DD 0, transparent 60%), #E5EFE8',
  'radial-gradient(at 25% 20%, #F3E8F2 0, transparent 55%), radial-gradient(at 75% 30%, #E8E3F3 0, transparent 50%), radial-gradient(at 48% 88%, #E4DCEC 0, transparent 60%), #EDE7F1',
  'radial-gradient(at 22% 26%, #F1EFE9 0, transparent 55%), radial-gradient(at 78% 24%, #EAE7E0 0, transparent 50%), radial-gradient(at 50% 86%, #E4E0D8 0, transparent 60%), #EDEAE3',
  'radial-gradient(at 27% 21%, #F9E9E0 0, transparent 55%), radial-gradient(at 73% 27%, #F3DED2 0, transparent 50%), radial-gradient(at 52% 86%, #ECDACF 0, transparent 60%), #F4E7DE',
  'radial-gradient(at 23% 25%, #F5F1DA 0, transparent 55%), radial-gradient(at 77% 23%, #EFEBD0 0, transparent 50%), radial-gradient(at 46% 87%, #E9E5C8 0, transparent 60%), #F2EEDA',
  'radial-gradient(at 29% 19%, #EEF2DC 0, transparent 55%), radial-gradient(at 71% 29%, #E6EDD2 0, transparent 50%), radial-gradient(at 54% 85%, #E1E8CB 0, transparent 60%), #EBF0DA',
  'radial-gradient(at 21% 23%, #E6F0E3 0, transparent 55%), radial-gradient(at 79% 25%, #DDEBDB 0, transparent 50%), radial-gradient(at 49% 88%, #D8E6D5 0, transparent 60%), #E3EDE1',
  'radial-gradient(at 26% 27%, #E0EFEE 0, transparent 55%), radial-gradient(at 74% 21%, #D7EAE8 0, transparent 50%), radial-gradient(at 53% 84%, #D2E5E3 0, transparent 60%), #DEEDEB',
  'radial-gradient(at 24% 18%, #E4EDF3 0, transparent 55%), radial-gradient(at 76% 31%, #DAE6EF 0, transparent 50%), radial-gradient(at 47% 86%, #D5E1EA 0, transparent 60%), #E1EAF1',
  'radial-gradient(at 28% 24%, #E7E8F5 0, transparent 55%), radial-gradient(at 72% 24%, #DEE0F0 0, transparent 50%), radial-gradient(at 51% 87%, #D9DBEB 0, transparent 60%), #E4E6F2',
  'radial-gradient(at 22% 20%, #F0E6F3 0, transparent 55%), radial-gradient(at 78% 28%, #E9DEEE 0, transparent 50%), radial-gradient(at 45% 85%, #E4D9E9 0, transparent 60%), #EDE3F0',
  'radial-gradient(at 27% 26%, #F4E6EF 0, transparent 55%), radial-gradient(at 73% 22%, #EDDEE8 0, transparent 50%), radial-gradient(at 55% 88%, #E8D9E3 0, transparent 60%), #F1E3EC',
  'radial-gradient(at 25% 22%, #F8E6E8 0, transparent 55%), radial-gradient(at 75% 26%, #F2DDE0 0, transparent 50%), radial-gradient(at 48% 86%, #EDD8DB 0, transparent 60%), #F5E3E5',
] as const;


/**
 * FNV-1a sobre el id entero. Los cuid comparten prefijo (`c` + reloj), así que
 * lo que distingue una galería de otra está al FINAL: una suma que pese poco la
 * cola dejaría a las creadas el mismo día en el mismo color, que es justo el
 * caso que este degradado existe para separar.
 */
function hash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Devuelve el PAR de degradados como variables inline, no una cadena: el
 * elemento las lleva las dos y la regla `.degradado` de `globals.css` elige
 * según el tema. Con una sola cadena habría que re-renderizar al cambiar de
 * tema —y el degradado de una portada que aún no ha cargado se vería saltar—.
 */
export function degradadoDe(id: string): CSSProperties {
  const i = hash(id) % DEGRADADOS.length;
  return { '--deg-oscuro': DEGRADADOS[i]!, '--deg-claro': DEGRADADOS_CLAROS[i]! } as CSSProperties;
}

/**
 * LOS DEL EDITOR SON OTROS. Misma paleta de tonos, distinta receta: el prototipo
 * del editor usa `110% 80% ... 60%` y la lista `120% 90% ... 55%`. No es un
 * descuido — la tesela del editor es 3:4 y pequeña, así que el foco tiene que ser
 * más cerrado y caer antes para que el color se lea a ese tamaño.
 *
 * Los cuatro primeros están copiados carácter a carácter de
 * `docs/mockups-admin/Editor.dc.html`; los doce siguientes reusan los mismos
 * tonos que la lista con la geometría del editor. Hay test de ambas cosas.
 */
const MEDIOS = [
  'radial-gradient(110% 80% at 50% 30%, #4A3A28 0%, #1C1512 60%, #080706 100%)',
  'radial-gradient(110% 80% at 45% 35%, #3A3140 0%, #191418 60%, #080706 100%)',
  'radial-gradient(110% 80% at 50% 40%, #2E3A33 0%, #141A17 60%, #080706 100%)',
  'radial-gradient(110% 80% at 55% 45%, #453322 0%, #1B1410 60%, #080706 100%)',
  'radial-gradient(110% 80% at 40% 35%, #3F2B2B 0%, #1A1212 60%, #080706 100%)',
  'radial-gradient(110% 80% at 60% 50%, #2B3340 0%, #12161A 60%, #080706 100%)',
  'radial-gradient(110% 80% at 35% 45%, #432F28 0%, #1D1411 60%, #080706 100%)',
  'radial-gradient(110% 80% at 65% 30%, #464325 0%, #1E1D10 60%, #080706 100%)',
  'radial-gradient(110% 80% at 48% 55%, #3A4229 0%, #191C11 60%, #080706 100%)',
  'radial-gradient(110% 80% at 30% 40%, #2E402B 0%, #141C12 60%, #080706 100%)',
  'radial-gradient(110% 80% at 58% 38%, #29423E 0%, #111C1B 60%, #080706 100%)',
  'radial-gradient(110% 80% at 42% 60%, #293C42 0%, #111A1C 60%, #080706 100%)',
  'radial-gradient(110% 80% at 62% 42%, #2A2A41 0%, #12121C 60%, #080706 100%)',
  'radial-gradient(110% 80% at 38% 30%, #3F2C3F 0%, #1B131B 60%, #080706 100%)',
  'radial-gradient(110% 80% at 52% 48%, #412A39 0%, #1C1219 60%, #080706 100%)',
  'radial-gradient(110% 80% at 45% 38%, #402B32 0%, #1C1215 60%, #080706 100%)',
] as const;

/**
 * El degradado de una tesela de medio. Se le pasa el id del MEDIO, no el de la
 * galería: si no, las ocho teselas de una boda saldrían del mismo color y el
 * degradado dejaría de distinguir nada justo en la pantalla donde más falta hace
 * —la que tiene ocho miniaturas negras hasta que llega el póster—.
 */
export function degradadoMedio(id: string): CSSProperties {
  const i = hash(id) % MEDIOS.length;
  return { '--deg-oscuro': MEDIOS[i]!, '--deg-claro': MEDIOS_CLAROS[i]! } as CSSProperties;
}


/**
 * Los claros de la tesela. Mismos tonos que `DEGRADADOS_CLAROS` y en el mismo
 * orden, pero las manchas caen antes (48/45/52 en vez de 55/50/60): la tesela
 * es 3:4 y pequeña, y con la caída larga el color se diluye hasta no
 * distinguirse del `card`. Es la misma razón por la que la receta oscura de la
 * tesela cierra el foco.
 */
const MEDIOS_CLAROS = DEGRADADOS_CLAROS.map((g) =>
  g.replace(/transparent 55%/g, 'transparent 48%')
    .replace(/transparent 5[02]%/g, 'transparent 45%')
    .replace(/transparent 60%/g, 'transparent 52%'),
);

/** Solo para el test: nadie puede recortar las paletas ni tocar lo aprobado. */
export const PALETA = {
  todos: DEGRADADOS,
  delPrototipo: DEL_PROTOTIPO,
  medios: MEDIOS,
  claros: DEGRADADOS_CLAROS,
  mediosClaros: MEDIOS_CLAROS,
};
