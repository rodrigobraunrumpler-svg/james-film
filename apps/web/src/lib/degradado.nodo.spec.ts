import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { degradado, PALETA } from './degradado';

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `cmex8q${String(i).padStart(4, '0')}k3p9`);

describe('degradado de galería', () => {
  it('es EL MISMO que el del admin, carácter a carácter', () => {
    // Si divergieran, James vería una boda «marrón» al subirla y «verde» al
    // publicarla, y el color dejaría de identificar nada. Se lee del fichero
    // del admin, no de una copia: así no pueden separarse en silencio.
    const delAdmin = readFileSync(
      new URL('../../../admin/src/lib/degradado.ts', import.meta.url),
      'utf8',
    );
    const suyos = [
      ...new Set(
        delAdmin.match(
          /radial-gradient\(120% 90% at \d+% \d+%, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 55%, #080706 100%\)/g,
        ) ?? [],
      ),
    ];
    expect(suyos).toHaveLength(16);
    expect([...PALETA]).toEqual(suyos);
  });

  it('el mismo id da siempre el mismo color', () => {
    expect(degradado('cmex8q0001k3p9')).toBe(degradado('cmex8q0001k3p9'));
  });

  it('reparte entre ids que comparten prefijo, que es el caso real', () => {
    // Doce galerías creadas el mismo día no pueden salir en tres colores.
    expect(new Set(ids(12).map(degradado)).size).toBeGreaterThanOrEqual(8);
  });
});
