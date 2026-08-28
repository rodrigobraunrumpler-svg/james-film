import { firstValueFrom, of } from 'rxjs';
import { MediaUrlInterceptor } from './media-url.interceptor.js';

const storage = { getPublicUrl: (k: string) => `https://cdn.test/${k}` };
const interceptor = new MediaUrlInterceptor(
  storage as unknown as ConstructorParameters<typeof MediaUrlInterceptor>[0],
);

const pasar = (payload: unknown) =>
  firstValueFrom(
    interceptor.intercept({} as never, { handle: () => of(payload) } as never),
  );

describe('MediaUrlInterceptor', () => {
  it('storageKey se convierte en url y la key desaparece del DTO', async () => {
    expect(await pasar({ id: 'm1', storageKey: 'videos/a.mp4' })).toEqual({
      id: 'm1',
      url: 'https://cdn.test/videos/a.mp4',
    });
  });

  it('posterKey y coverKey siguen la convención', async () => {
    expect(await pasar({ posterKey: 'posters/a.webp', coverKey: null })).toEqual({
      posterUrl: 'https://cdn.test/posters/a.webp',
      coverUrl: null,
    });
  });

  it('funciona en profundidad, dentro de arrays y objetos anidados', async () => {
    const salida = (await pasar({
      items: [{ storageKey: 'videos/a.mp4' }, { storageKey: 'videos/b.mp4' }],
      meta: { pageCount: 1 },
    })) as { items: { url: string }[]; meta: { pageCount: number } };

    expect(salida.items.map((i) => i.url)).toEqual([
      'https://cdn.test/videos/a.mp4',
      'https://cdn.test/videos/b.mp4',
    ]);
    expect(salida.meta.pageCount).toBe(1);
  });

  it('no toca las fechas', async () => {
    const fecha = new Date('2026-03-15T00:00:00.000Z');
    const salida = (await pasar({ createdAt: fecha })) as { createdAt: Date };
    expect(salida.createdAt).toBe(fecha);
  });
});
