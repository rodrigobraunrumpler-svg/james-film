import type { GalleryListItemDto } from '@james-film/contracts';

/**
 * Cómo se llama lo que hay DENTRO de una galería.
 *
 * La web escribía «reels» en todas partes contra `mediaCount`, que es el total
 * de medios: una galería de tres fotos anunciaba «3 reels» en la portada. Una
 * cifra falsa en la vitrina es exactamente lo que este proyecto no publica —la
 * misma razón por la que se corrigieron «7 reels» y «24 horas» del flyer—.
 *
 * Los vídeos se dicen «reels» aunque el tipo sea `AFTERMOVIE`: es el nombre del
 * producto, es lo que dice el flyer y es lo que el cliente busca. Lo que no se
 * puede es llamar reel a una foto.
 */
export function piezas(g: Pick<GalleryListItemDto, 'mediaCount' | 'photoCount'>): string {
  const fotos = g.photoCount;
  const videos = Math.max(0, g.mediaCount - fotos);
  const partes: string[] = [];
  if (videos > 0) partes.push(`${videos} ${videos === 1 ? 'reel' : 'reels'}`);
  if (fotos > 0) partes.push(`${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`);
  return partes.join(' · ');
}

/**
 * Lo mismo, pero de una sola pieza: manda lo que más hay.
 *
 * Para los sitios donde el texto comparte línea con otra cosa —el chip del hero
 * lleva además el título del trabajo— y «2 reels · 8 fotos · Boda de Ana» no
 * cabe en un móvil. Se pierde precisión, no se gana mentira: si son ocho fotos
 * y dos reels, dice «8 fotos».
 */
export function piezasCorto(g: Pick<GalleryListItemDto, 'mediaCount' | 'photoCount'>): string {
  const fotos = g.photoCount;
  const videos = Math.max(0, g.mediaCount - fotos);
  if (videos >= fotos) return videos > 0 ? `${videos} ${videos === 1 ? 'reel' : 'reels'}` : '';
  return `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`;
}

/** Cuántos VÍDEOS hay en total. Para las cifras que suman toda la web. */
export function videosDe(gs: Pick<GalleryListItemDto, 'mediaCount' | 'photoCount'>[]): number {
  return gs.reduce((n, g) => n + Math.max(0, g.mediaCount - g.photoCount), 0);
}

/** Y cuántas FOTOS. Se dicen aparte: sumarlas bajo «reels» era el fallo. */
export function fotosDe(gs: Pick<GalleryListItemDto, 'photoCount'>[]): number {
  return gs.reduce((n, g) => n + g.photoCount, 0);
}
