import { SlugService } from './slug.service.js';

describe('SlugService', () => {
  const service = new SlugService();
  const libre = async () => false;

  it('slugifica quitando acentos, ñ y mayúsculas', async () => {
    expect(await service.unique('XV de Camila', libre)).toBe('xv-de-camila');
    expect(await service.unique('Cumpleaños Ñoño', libre)).toBe('cumpleanos-nono');
    expect(await service.unique('  Boda   Ana  ', libre)).toBe('boda-ana');
  });

  it('desambigua con sufijo numérico cuando ya existe', async () => {
    const ocupados = new Set(['boda-ana', 'boda-ana-2']);
    expect(await service.unique('Boda Ana', async (s) => ocupados.has(s))).toBe('boda-ana-3');
  });

  it('nunca devuelve cadena vacía', async () => {
    // Un título de solo emoji o solo símbolos slugifica a "": sin este caso,
    // la galería quedaría en /galeria/ y colisionaría con la siguiente igual.
    expect(await service.unique('🎬🎬🎬', libre)).toBe('sin-titulo');
    expect(await service.unique('///', libre)).toBe('sin-titulo');
  });

  it('el sondeo recibe el candidato exacto que se va a usar', async () => {
    const vistos: string[] = [];
    await service.unique('Boda Ana', async (s) => {
      vistos.push(s);
      return vistos.length < 3;
    });
    expect(vistos).toEqual(['boda-ana', 'boda-ana-2', 'boda-ana-3']);
  });
});
