import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type FlaggableDelegate = {
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, boolean>;
  }): Prisma.PrismaPromise<unknown>;
  update(args: {
    where: { id: string };
    data: Record<string, boolean>;
  }): Prisma.PrismaPromise<unknown>;
};

/**
 * Marca uno y desmarca el resto, en una transacción.
 * Lo usan Package.isHighlighted, Gallery.isFeatured y Media.isFeatured.
 */
@Injectable()
export class ExclusiveFlagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `scope` es lo que permite reusarlo en Media.isFeatured, donde la portada es
   * única POR GALERÍA. Sin él, marcar la portada de la boda de Ana desmarcaría
   * la de los XV de Camila.
   */
  setOnly<T extends FlaggableDelegate>(
    delegate: T,
    field: string,
    id: string,
    scope: Record<string, unknown> = {},
  ): Promise<unknown[]> {
    return this.prisma.$transaction([
      delegate.updateMany({ where: scope, data: { [field]: false } }),
      delegate.update({ where: { id }, data: { [field]: true } }),
    ]);
  }
}
