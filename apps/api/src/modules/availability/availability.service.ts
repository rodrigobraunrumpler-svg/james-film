import { Injectable } from '@nestjs/common';
import type {
  AvailabilityDto,
  AvailabilitySummaryDto,
  BookingDto,
  BusyDayDto,
  IsoDate,
  RequestedDateDto,
  SaturdayCountDto,
  SetAvailabilityInput,
} from '@james-film/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { aFechaUtc, aIsoDate, hoyEnLima, masMeses } from './fechas.js';

/**
 * Cuánto futuro publica la web. Doce meses porque alguien reserva en septiembre
 * para «enero o febrero»: con seis, la mitad de esas consultas caen fuera del
 * dato y la web no puede contestarlas.
 */
const MESES_DE_VENTANA = 12;

/** Cuánto pasado se mira buscando trabajo sin publicar. Tres meses: más atrás
 *  ya no es un olvido, es una decisión. */
const MESES_HACIA_ATRAS = 3;

/** Cuántos meses de sábados se resumen. Tres es lo que se decide de una vez. */
const MESES_DE_SABADOS = 3;

/** Cuántas fechas pedidas se enseñan. Cinco caben en la tarjeta y decidir con
 *  más de cinco no es decidir, es leer una tabla. */
const CUANTAS_PEDIDAS = 5;

/**
 * Las fechas más pedidas, la más pedida primero y **las ocupadas antes que las
 * libres** cuando empatan: una fecha libre muy pedida es una buena noticia, una
 * ocupada muy pedida es dinero que se está yendo, y esa segunda es la que tiene
 * que salir arriba.
 */
export function masPedidas(
  filas: { requestedDate: Date | null; _count: { _all: number } }[],
  ocupados: Set<IsoDate>,
): RequestedDateDto[] {
  return filas
    .filter((f) => f.requestedDate !== null)
    .map((f) => {
      const date = aIsoDate(f.requestedDate!);
      return { date, count: f._count._all, busy: ocupados.has(date) };
    })
    .sort((a, b) => b.count - a.count || Number(b.busy) - Number(a.busy) || a.date.localeCompare(b.date))
    .slice(0, CUANTAS_PEDIDAS);
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que ve el ADMIN, con la nota. Anotado con el DTO: un `select` incompleto no compila. */
  async listar(from: IsoDate, to: IsoDate): Promise<BusyDayDto[]> {
    const filas = await this.prisma.busyDay.findMany({
      where: { date: { gte: aFechaUtc(from), lte: aFechaUtc(to) } },
      select: { date: true, note: true, groupId: true },
      // Sin desempate por `id`: `date` es único. La regla del `{ id: 'asc' }`
      // aplica a los `order @default(0)`, que sí empatan.
      orderBy: { date: 'asc' },
    });
    return filas.map((f) => ({ date: aIsoDate(f.date), note: f.note, groupId: f.groupId }));
  }

  /**
   * Lo que consume la landing. **Sin notas y sin ids**: un día ocupado dice
   * «ocupado» y nada más — el tipo de evento y el lugar son datos de un cliente
   * que no ha dado permiso para publicarlos (Ley 29733).
   */
  async publica(ahora: Date = new Date()): Promise<AvailabilityDto> {
    const desde = hoyEnLima(ahora);
    const until = masMeses(desde, MESES_DE_VENTANA);

    const [filas, ajustes] = await Promise.all([
      this.prisma.busyDay.findMany({
        where: { date: { gte: aFechaUtc(desde), lte: aFechaUtc(until) } },
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.siteSettings.findUnique({
        where: { id: 'singleton' },
        select: { availabilityUpdatedAt: true },
      }),
    ]);

    return {
      busy: filas.map((f) => aIsoDate(f.date)),
      // `until` se CALCULA, no se guarda: guardarlo obligaría a moverlo cada día.
      until,
      updatedAt: ajustes?.availabilityUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Colapsa los días en reservas. Lo usan el Panel y el aviso; **no** el
   * endpoint público: a la landing le da igual si dos días son una boda o dos.
   */
  agrupar(dias: BusyDayDto[]): BookingDto[] {
    const porGrupo = new Map<string, BusyDayDto[]>();
    for (const d of dias) {
      // Un día suelto es su propio grupo, con su fecha de clave: así el resto
      // del código no tiene que distinguir los dos casos.
      const clave = d.groupId ?? `dia:${d.date}`;
      const ya = porGrupo.get(clave);
      if (ya) ya.push(d);
      else porGrupo.set(clave, [d]);
    }

    return [...porGrupo.entries()]
      .map(([id, dd]) => {
        // Ya vienen ordenados por fecha, pero el grupo puede tener huecos si se
        // desmarcó el día del medio: `from` y `to` son los extremos reales.
        const fechas = dd.map((d) => d.date).sort();
        return { id, from: fechas[0]!, to: fechas[fechas.length - 1]!, note: dd[0]?.note ?? null };
      })
      .sort((a, b) => a.from.localeCompare(b.from));
  }

  /**
   * Todo lo que la pantalla de Disponibilidad enseña, en UNA consulta por
   * fuente. Mismo criterio que el Panel: pintarla a trozos daría cuatro saltos
   * de layout en el 4G de James.
   */
  /**
   * Lo que sale de los DÍAS, y que **el Panel también necesita**: las reservas
   * que vienen, las que ya pasaron sin galería y los sábados libres.
   *
   * Vive aquí y no duplicado en el dashboard porque el cruce «reserva pasada
   * sin galería» tiene una sutileza —la galería del primer día cubre la boda
   * entera— que escrita dos veces se desincroniza a la primera.
   */
  async paraElPanel(ahora: Date = new Date()): Promise<{
    proximas: BookingDto[];
    sinGaleria: BookingDto[];
    sabados: SaturdayCountDto[];
    ocupados: Set<IsoDate>;
  }> {
    const hoy = hoyEnLima(ahora);
    const desde = masMeses(hoy, -MESES_HACIA_ATRAS);
    const hasta = masMeses(hoy, MESES_DE_VENTANA);

    const [dias, galerias] = await Promise.all([
      this.prisma.busyDay.findMany({
        where: { date: { gte: aFechaUtc(desde), lte: aFechaUtc(hasta) } },
        select: { date: true, note: true, groupId: true },
        orderBy: { date: 'asc' },
      }),
      // Las fechas de evento de las galerías vivas, para cruzarlas con los días
      // ocupados que ya pasaron. Solo la fecha: no hace falta nada más.
      this.prisma.gallery.findMany({
        where: { deletedAt: null, eventDate: { gte: aFechaUtc(desde), lte: aFechaUtc(hoy) } },
        select: { eventDate: true },
      }),
    ]);

    const todas = dias.map((d) => ({
      date: aIsoDate(d.date),
      note: d.note,
      groupId: d.groupId,
    }));
    const reservas = this.agrupar(todas);

    /**
     * Una galería «cubre» una reserva si su `eventDate` cae dentro. Con el día
     * exacto no bastaba: James pone la fecha del primer día de una boda de dos,
     * y la reserva entera quedaría marcada como sin publicar.
     */
    const fechasDeGalerias = new Set(
      galerias.map((g) => (g.eventDate ? aIsoDate(g.eventDate) : '')).filter(Boolean),
    );
    const cubierta = (r: BookingDto): boolean =>
      [...fechasDeGalerias].some((f) => f >= r.from && f <= r.to);

    const ocupados = new Set(todas.map((d) => d.date));
    return {
      proximas: reservas.filter((r) => r.to >= hoy),
      // Solo las que ya TERMINARON: una boda que es hoy no es un olvido.
      sinGaleria: reservas.filter((r) => r.to < hoy && !cubierta(r)).reverse(),
      sabados: this.sabados(hoy, ocupados),
      ocupados,
    };
  }

  async resumen(ahora: Date = new Date()): Promise<AvailabilitySummaryDto> {
    const hace30 = new Date(ahora.getTime() - 30 * 86_400_000);

    const [delPanel, clicsLibre, clicsOcupado, pedidas, ajustes] = await Promise.all([
      this.paraElPanel(ahora),
      this.prisma.whatsappClick.count({
        where: { source: 'calendario-libre', createdAt: { gte: hace30 } },
      }),
      this.prisma.whatsappClick.count({
        where: { source: 'calendario-ocupado', createdAt: { gte: hace30 } },
      }),
      /**
       * QUÉ fechas piden. `groupBy` y no traerse los clics: son las fechas
       * distintas lo que interesa, no cada clic, y el índice
       * `(source, requestedDate)` lo resuelve sin tocar filas.
       */
      this.prisma.whatsappClick.groupBy({
        by: ['requestedDate'],
        where: {
          requestedDate: { not: null },
          createdAt: { gte: hace30 },
          source: { in: ['calendario-libre', 'calendario-ocupado'] },
        },
        _count: { _all: true },
      }),
      this.prisma.siteSettings.findUnique({
        where: { id: 'singleton' },
        select: { availabilityUpdatedAt: true },
      }),
    ]);

    return {
      proximas: delPanel.proximas,
      sinGaleria: delPanel.sinGaleria,
      sabados: delPanel.sabados,
      clicks: { free: clicsLibre, busy: clicsOcupado },
      masPedidas: masPedidas(pedidas, delPanel.ocupados),
      updatedAt: ajustes?.availabilityUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Sábados libres por mes. **Desde HOY, no desde el día 1**: a mitad de mes,
   * contar los sábados que ya pasaron diría que quedan cuatro cuando queda uno,
   * y ese número es el que decide si sube el precio.
   */
  private sabados(hoy: IsoDate, ocupados: Set<IsoDate>): SaturdayCountDto[] {
    const salida: SaturdayCountDto[] = [];
    const [a0, m0] = hoy.split('-').map(Number);

    for (let i = 0; i < MESES_DE_SABADOS; i++) {
      const cursor = new Date(Date.UTC(a0!, m0! - 1 + i, 1));
      const anio = cursor.getUTCFullYear();
      const mes = cursor.getUTCMonth();
      const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

      let total = 0;
      let libres = 0;
      for (let d = 1; d <= ultimo; d++) {
        const dia = new Date(Date.UTC(anio, mes, d));
        if (dia.getUTCDay() !== 6) continue;
        const iso = aIsoDate(dia);
        if (iso < hoy) continue;
        total++;
        if (!ocupados.has(iso)) libres++;
      }
      salida.push({ month: aIsoDate(new Date(Date.UTC(anio, mes, 1))), free: libres, total });
    }
    return salida;
  }

  /**
   * Marca o desmarca, en una transacción. **Idempotente en los dos sentidos**:
   * marcar lo ya marcado no duplica ni lanza P2002, y desmarcar lo que no
   * existe no revienta.
   */
  async marcar(input: SetAvailabilityInput): Promise<BusyDayDto[]> {
    const fechas = [...new Set(input.dates)].sort();

    await this.prisma.$transaction(async (tx) => {
      if (input.busy) {
        /**
         * UN grupo para toda la tanda: es lo que convierte «24 y 25» en una
         * reserva. Un día suelto también crea grupo, así ampliarla después es
         * reasignar y no un caso especial.
         */
        const groupId = crypto.randomUUID();
        await tx.busyDay.createMany({
          data: fechas.map((f) => ({ date: aFechaUtc(f), note: input.note ?? null, groupId })),
          skipDuplicates: true,
        });
        // `createMany` con `skipDuplicates` no toca los que ya existían, así que
        // el `updateMany` es lo que hace que remarcar un día lo mueva de grupo y
        // actualice su nota.
        await tx.busyDay.updateMany({
          where: { date: { in: fechas.map(aFechaUtc) } },
          data: { note: input.note ?? null, groupId },
        });
      } else {
        // Desmarcar el día del MEDIO parte la reserva y no pasa nada: los que
        // quedan siguen compartiendo grupo y se pintan como dos bloques. Por eso
        // el grupo es una etiqueta y no un rango — no hay nada que reparar.
        await tx.busyDay.deleteMany({ where: { date: { in: fechas.map(aFechaUtc) } } });
      }

      /**
       * El instante de la ACCIÓN, no el de las filas. Con `max(updatedAt)`,
       * desmarcar la fila más reciente haría RETROCEDER el máximo y la web
       * diría «actualizado hace un mes» justo después de tocarlo.
       */
      await tx.siteSettings.update({
        where: { id: 'singleton' },
        data: { availabilityUpdatedAt: new Date() },
      });
    });

    return fechas.length > 0 ? this.listar(fechas[0]!, fechas[fechas.length - 1]!) : [];
  }
}
