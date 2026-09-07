import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Clave de Postgres para violación de clave foránea. */
const FK_VIOLADA = '23503';

@Injectable()
export class TrackingService {
  private readonly log = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * El clic ES el lead: no puede fallar por un dato accesorio. Si el
   * `packageId` ya no existe —James borró el paquete después de que Astro
   * generase la página, que es un escenario normal— se guarda el clic SIN
   * atribución en vez de perderlo. Se pierde el «de qué paquete venía»;
   * perder el clic entero sería perder la única métrica del negocio.
   */
  async registrar(
    packageId: string | undefined,
    source: string | undefined,
    requestedDate?: string | null,
  ): Promise<void> {
    // Fecha de calendario: medianoche UTC, como toda `@db.Date`. Formatearla en
    // Lima restaría cinco horas y guardaría el día anterior.
    const fecha = requestedDate ? new Date(`${requestedDate}T00:00:00.000Z`) : null;
    try {
      await this.prisma.whatsappClick.create({
        data: { packageId: packageId ?? null, source: source ?? null, requestedDate: fecha },
        select: { id: true },
      });
    } catch (e) {
      if (!esFkViolada(e)) throw e;
      this.log.warn(`Clic con packageId inexistente (${packageId}); se guarda sin atribución.`);
      await this.prisma.whatsappClick.create({
        data: { packageId: null, source: source ?? null, requestedDate: fecha },
        select: { id: true },
      });
    }
  }
}

/**
 * En Prisma 7 con driver adapter, `meta` ya no trae `target`: la causa real
 * viene anidada bajo `driverAdapterError`. Se comprueba el `code` de arriba
 * —`P2003`— que sí sigue existiendo, y el de Postgres como respaldo.
 */
function esFkViolada(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const codigo = (e as { code?: unknown }).code;
  return codigo === 'P2003' || codigo === FK_VIOLADA;
}
