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

export function degradadoDe(id: string): string {
  return DEGRADADOS[hash(id) % DEGRADADOS.length]!;
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
export function degradadoMedio(id: string): string {
  return MEDIOS[hash(id) % MEDIOS.length]!;
}

/** Solo para el test: nadie puede recortar las paletas ni tocar lo aprobado. */
export const PALETA = { todos: DEGRADADOS, delPrototipo: DEL_PROTOTIPO, medios: MEDIOS };
