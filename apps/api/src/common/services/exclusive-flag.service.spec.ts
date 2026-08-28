import { ExclusiveFlagService } from './exclusive-flag.service.js';

/** Registra las operaciones que se pasan a $transaction, sin tocar la base. */
function crearDobles() {
  const llamadas: unknown[] = [];
  const prisma = {
    $transaction: (ops: unknown[]) => {
      llamadas.push(...ops);
      return Promise.resolve([]);
    },
  };
  const delegate = {
    updateMany: (args: unknown) => ({ op: 'updateMany', args }),
    update: (args: unknown) => ({ op: 'update', args }),
  };
  const service = new ExclusiveFlagService(
    prisma as unknown as ConstructorParameters<typeof ExclusiveFlagService>[0],
  );
  return { llamadas, delegate: delegate as unknown as Parameters<typeof service.setOnly>[0], service };
}

describe('ExclusiveFlagService', () => {
  it('desmarca todo y marca uno, en una sola transacción', async () => {
    const { llamadas, delegate, service } = crearDobles();
    await service.setOnly(delegate, 'isHighlighted', 'pkg_1');

    expect(llamadas).toEqual([
      { op: 'updateMany', args: { where: {}, data: { isHighlighted: false } } },
      { op: 'update', args: { where: { id: 'pkg_1' }, data: { isHighlighted: true } } },
    ]);
  });

  it('el scope limita el desmarcado: la portada es única POR GALERÍA', async () => {
    // Sin scope, marcar la portada de la boda de Ana desmarcaría la de los XV de Camila.
    const { llamadas, delegate, service } = crearDobles();
    await service.setOnly(delegate, 'isFeatured', 'med_7', { galleryId: 'gal_1' });

    expect(llamadas[0]).toEqual({
      op: 'updateMany',
      args: { where: { galleryId: 'gal_1' }, data: { isFeatured: false } },
    });
  });
});
