import { Injectable } from '@nestjs/common';
import slugify from 'slugify';

@Injectable()
export class SlugService {
  /**
   * Genera un slug único sondeando con `exists`.
   *
   * OJO con el `exists` de Gallery: NO debe filtrar `deletedAt`. El índice
   * `Gallery_slug_key` no es parcial, así que el slug de una galería borrada en
   * blando sigue ocupado; si el sondeo lo ignorase diría "libre" y el `create`
   * reventaría con P2002. Ver CLAUDE.md.
   */
  async unique(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
    // Un título de solo emoji o solo símbolos slugifica a "": sin este respaldo
    // la galería quedaría en `/galeria/` y colisionaría con la siguiente igual.
    const raiz = slugify(base, { lower: true, strict: true, locale: 'es', trim: true }) || 'sin-titulo';

    let candidato = raiz;
    let n = 2;
    while (await exists(candidato)) candidato = `${raiz}-${n++}`;
    return candidato;
  }
}
