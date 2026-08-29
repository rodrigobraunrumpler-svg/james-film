import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** `$transaction` con array exige PrismaPromise, no Promise a secas. */
type OrderableDelegate = {
  update(args: { where: { id: string }; data: { order: number } }): Prisma.PrismaPromise<unknown>;
};

/**
 * Ocho modelos tienen `order`. Escribir el reorden ocho veces es justo lo que
 * hay que evitar (§5). Se usa con los tipos intactos:
 * `this.reorder.reorder(this.prisma.media, dto.ids)`.
 */
@Injectable()
export class ReorderService {
  constructor(private readonly prisma: PrismaService) {}

  reorder(delegate: OrderableDelegate, ids: string[]): Promise<unknown[]> {
    return this.prisma.$transaction(
      ids.map((id, order) => delegate.update({ where: { id }, data: { order } })),
    );
  }
}
