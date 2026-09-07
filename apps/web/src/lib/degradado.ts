/**
 * El degradado propio de cada galería, derivado de su id.
 *
 * **Es la MISMA paleta y el MISMO hash que el admin** (`apps/admin/src/lib/
 * degradado.ts`), a propósito: una galería tiene que verse del mismo color en
 * el panel y en la web. Si divergieran, James vería una boda «marrón» al
 * subirla y «verde» al publicarla, y el color dejaría de identificar nada.
 *
 * Se pinta DEBAJO de la portada: se ve mientras la imagen carga y es lo único
 * que hay cuando una galería aún no tiene ninguna. Sin él, seis eventos recién
 * creados son seis rectángulos negros idénticos.
 *
 * **No tiene variante clara**, y no es un olvido: los reels y las portadas se
 * quedan oscuros en los dos temas porque su fondo es el material —vídeo—, no la
 * superficie de la página.
 */
const DEGRADADOS = [
  'radial-gradient(120% 90% at 30% 25%, #4A3A28 0%, #1C1512 55%, #080706 100%)',
  'radial-gradient(120% 90% at 65% 30%, #3A3140 0%, #191418 55%, #080706 100%)',
  'radial-gradient(120% 90% at 45% 60%, #2E3A33 0%, #141A17 55%, #080706 100%)',
  'radial-gradient(120% 90% at 55% 35%, #453322 0%, #1B1410 55%, #080706 100%)',
  'radial-gradient(120% 90% at 40% 40%, #3F2B2B 0%, #1A1212 55%, #080706 100%)',
  'radial-gradient(120% 90% at 60% 50%, #2B3340 0%, #12161A 55%, #080706 100%)',
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

/**
 * FNV-1a sobre el id entero. Los cuid comparten prefijo —`c` más el reloj— así
 * que lo que distingue una galería de otra está al FINAL: una suma que pese
 * poco la cola dejaría a todas las creadas el mismo día del mismo color, que es
 * justo el caso que este degradado existe para separar.
 */
function hash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const degradado = (id: string): string => DEGRADADOS[hash(id) % DEGRADADOS.length]!;

/** Solo para el test: nadie puede recortar la paleta sin que se note. */
export const PALETA = DEGRADADOS;
