import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AttentionItemDto,
  ClickDayDto,
  ClickStatsDto,
  DashboardDto,
  DeployStateDto,
  StorageUsageDto,
  WhatsappSource,
} from '@james-film/contracts';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { claveDePortada } from '../galleries/galleries.mapper.js';

const DIA = 86_400_000;
const VENTANA = 30;

/** Un borrador es trabajo en curso hasta que pasan tres días. Antes, avisar molesta. */
const DIAS_BORRADOR_RANCIO = 3;

/**
 * `YYYY-MM-DD` en **hora de Lima**, no en UTC.
 *
 * El comentario que había aquí mezclaba dos cosas distintas: «no uses la zona
 * del proceso» —correcto, la máquina de desarrollo está en Lima y el contenedor
 * en UTC— con «usa UTC», que para ESTE dato es incorrecto. La regla buena es
 * **zona explícita**, y la explícita para lo que lee James es la suya.
 *
 * Lo que agrupa esta función es el `createdAt` de un clic, que es un INSTANTE
 * —un momento que ocurrió—, no una fecha de calendario. Con UTC, **todo clic a
 * partir de las 19:00 de Lima contaba como el día siguiente**: casi un tercio
 * del día atribuido mal, en un negocio donde se escribe por la tarde.
 *
 * La distinción, que se vuelve a colar si no está escrita:
 *   · Fecha de calendario (`eventDate`, `BusyDay.date`, todo `@db.Date`) → UTC.
 *     Se guarda a medianoche UTC y en Lima restaría 5 h: saldría el día anterior.
 *   · Instante (`createdAt` de un clic, `updatedAt`) → `America/Lima`.
 *
 * `en-CA` da el `YYYY-MM-DD` ya ordenado sin montar la cadena a mano.
 */
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

function claveDia(fecha: Date): string {
  return DIA_LIMA.format(fecha);
}

/**
 * Lo justo para pintar la miniatura del aviso: la portada sale del medio
 * destacado, igual que en la lista de galerías.
 */
const SELECT_MINIATURA = {
  id: true,
  title: true,
  media: {
    where: { isFeatured: true, deletedAt: null },
    select: { isFeatured: true, posterKey: true, storageKey: true, type: true },
    take: 1,
  },
} as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private portada(media: Parameters<typeof claveDePortada>[0]): string | null {
    const clave = claveDePortada(media);
    return clave ? this.storage.getPublicUrl(clave) : null;
  }

  async resumen(ahora = new Date()): Promise<DashboardDto> {
    const [attention, clicks, storage, deploy, ultimaGaleria, disponibilidad] = await Promise.all([
      this.avisos(ahora),
      this.clics(ahora),
      this.almacenamiento(),
      this.deploy(),
      this.ultimaGaleria(),
      this.availability.paraElPanel(ahora),
    ]);
    return { attention, clicks, storage, deploy, ultimaGaleria, saturdays: disponibilidad.sabados };
  }

  /**
   * Los tres avisos de §9, cada uno con su acción. El orden es el de gravedad:
   * un deploy fallido significa que la web enseña lo de antes, y eso cuesta más
   * caro que cualquier otra cosa de esta lista.
   */
  private async avisos(ahora: Date): Promise<AttentionItemDto[]> {
    const limiteBorrador = new Date(ahora.getTime() - DIAS_BORRADOR_RANCIO * DIA);

    const [deploy, fallidos, borradores] = await Promise.all([
      this.prisma.deployState.findUnique({
        where: { id: 'singleton' },
        select: { status: true, error: true, finishedAt: true },
      }),
      // Agrupado POR GALERÍA: ocho reels rotos de la misma boda son un problema,
      // no ocho. Ocho avisos idénticos entrenan a descartarlos sin leer.
      this.prisma.media.groupBy({
        by: ['galleryId'],
        where: { status: 'FAILED', deletedAt: null, gallery: { deletedAt: null } },
        _count: { _all: true },
      }),
      this.prisma.gallery.findMany({
        where: { isPublished: false, deletedAt: null, createdAt: { lt: limiteBorrador } },
        select: { ...SELECT_MINIATURA, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 5,
      }),
    ]);

    const avisos: AttentionItemDto[] = [];

    if (deploy?.status === 'FAILED') {
      avisos.push({
        id: `deploy:${deploy.finishedAt?.toISOString() ?? 'sin-fecha'}`,
        kind: 'DEPLOY_FAILED',
        title: 'El último intento de publicar falló',
        detail: deploy.error ?? 'La web sigue mostrando lo de antes.',
        href: '/panel',
        accion: 'Reintentar',
        coverUrl: null,
        galleryId: null,
        grave: true,
        since: deploy.finishedAt?.toISOString() ?? null,
      });
    }

    if (fallidos.length > 0) {
      const galerias = await this.prisma.gallery.findMany({
        where: { id: { in: fallidos.map((f) => f.galleryId) } },
        select: SELECT_MINIATURA,
      });
      const porId = new Map(galerias.map((g) => [g.id, g]));

      for (const f of fallidos) {
        const n = f._count._all;
        const g = porId.get(f.galleryId);
        avisos.push({
          id: `media:${f.galleryId}:${n}`,
          kind: 'MEDIA_FAILED',
          title: `${n} ${n === 1 ? 'archivo no llegó' : 'archivos no llegaron'} a subirse`,
          // Sin esto un fallo es invisible: crees que subiste ocho y hay seis.
          detail: g ? `En «${g.title}»` : 'En una galería',
          href: `/galerias/${f.galleryId}`,
          accion: 'Ver la galería',
          coverUrl: g ? this.portada(g.media) : null,
          galleryId: f.galleryId,
          grave: false,
          since: null,
        });
      }
    }

    for (const b of borradores) {
      const dias = Math.floor((ahora.getTime() - b.createdAt.getTime()) / DIA);
      avisos.push({
        id: `borrador:${b.id}`,
        kind: 'STALE_DRAFT',
        title: `«${b.title}» lleva ${dias} días en borrador`,
        detail: 'Nadie la ve hasta que la publiques.',
        href: `/galerias/${b.id}`,
        accion: 'Abrir',
        coverUrl: this.portada(b.media),
        galleryId: b.id,
        grave: false,
        since: b.createdAt.toISOString(),
      });
    }

    /**
     * GRABADO Y SIN PUBLICAR, y va al final de la lista pero **no es el menos
     * importante**: es el único aviso del Panel que James no sabe ya por su
     * cuenta. Un borrador lo creó él; un archivo fallido lo vio fallar. Que una
     * boda de hace tres semanas no tenga galería no lo sabe nadie, y es trabajo
     * hecho que no está trayendo clientes.
     *
     * Va en `grave: false` aunque duela: el rojo se reserva a lo que ya salió
     * mal en la web, y esto es algo que falta por hacer.
     */
    const { sinGaleria } = await this.availability.paraElPanel(ahora);
    for (const r of sinGaleria.slice(0, 3)) {
      const dias = Math.max(0, Math.floor((ahora.getTime() - Date.parse(`${r.to}T00:00:00Z`)) / DIA));
      avisos.push({
        id: `sin-galeria:${r.id}`,
        kind: 'EVENT_WITHOUT_GALLERY',
        title:
          r.from === r.to
            ? `Grabaste el ${r.from} y no has subido nada`
            : `Grabaste del ${r.from} al ${r.to} y no has subido nada`,
        detail: r.note ? `${r.note} · hace ${dias} días` : `Hace ${dias} días`,
        // Con la galería a medio crear: llega a la pantalla con el formulario
        // abierto en vez de soltarle en la lista a buscar el botón.
        href: '/?nueva=1',
        accion: 'Crear su galería',
        coverUrl: null,
        galleryId: null,
        grave: false,
        since: `${r.to}T00:00:00.000Z`,
      });
    }

    return avisos;
  }

  /**
   * Ventanas MÓVILES de 30 días, no meses de calendario: así el número no
   * depende de la zona horaria ni salta el día 1. La serie se rellena con
   * ceros —un día sin clics es un dato, y sin él la gráfica se comprimiría
   * saltándose los huecos.
   */
  private async clics(ahora: Date): Promise<ClickStatsDto> {
    const desde = new Date(ahora.getTime() - VENTANA * DIA);
    const desdeAnterior = new Date(ahora.getTime() - 2 * VENTANA * DIA);

    const [filas, previousTotal, porPaquete, porFuente] = await Promise.all([
      this.prisma.whatsappClick.findMany({
        where: { createdAt: { gte: desde } },
        select: { createdAt: true },
      }),
      this.prisma.whatsappClick.count({
        where: { createdAt: { gte: desdeAnterior, lt: desde } },
      }),
      this.prisma.whatsappClick.groupBy({
        by: ['packageId'],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
      }),
      /**
       * De DÓNDE salió el clic, que es otra pregunta que de qué paquete.
       * El Panel solo contestaba la segunda, así que no se podía saber si el
       * calendario —o la línea de negocios, que es medio producto— trae gente.
       */
      this.prisma.whatsappClick.groupBy({
        by: ['source'],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
      }),
    ]);

    const cuenta = new Map<string, number>();
    for (const f of filas) {
      const k = claveDia(f.createdAt);
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }

    const daily: ClickDayDto[] = [];
    for (let i = VENTANA - 1; i >= 0; i--) {
      const date = claveDia(new Date(ahora.getTime() - i * DIA));
      daily.push({ date, count: cuenta.get(date) ?? 0 });
    }

    const idsConPaquete = porPaquete
      .map((p) => p.packageId)
      .filter((id): id is string => id !== null);
    const paquetes =
      idsConPaquete.length > 0
        ? await this.prisma.package.findMany({
            where: { id: { in: idsConPaquete } },
            select: { id: true, name: true },
          })
        : [];
    const nombre = new Map(paquetes.map((p) => [p.id, p.name]));

    const byPackage = porPaquete
      .filter((p) => p.packageId !== null)
      .map((p) => ({
        packageId: p.packageId as string,
        packageName: nombre.get(p.packageId as string) ?? 'Paquete borrado',
        count: p._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.packageId.localeCompare(b.packageId));

    return {
      total: filas.length,
      previousTotal,
      daily,
      byPackage,
      noPackage: porPaquete.find((p) => p.packageId === null)?._count._all ?? 0,
      /**
       * Las que NO tuvieron ninguno se quedan fuera: una lista con cinco ceros
       * ocupa el mismo sitio que los dos datos que importan y no informa. Y los
       * clics viejos sin fuente —los de antes de que existiera la lista— se
       * descartan en vez de inventarles una.
       */
      bySource: porFuente
        .filter((f): f is typeof f & { source: string } => f.source !== null)
        .map((f) => ({ source: f.source as WhatsappSource, clicks: f._count._all }))
        .sort((a, b) => b.clicks - a.clicks || a.source.localeCompare(b.source)),
    };
  }

  private async almacenamiento(): Promise<StorageUsageDto> {
    const { _sum } = await this.prisma.media.aggregate({
      _sum: { sizeBytes: true },
      where: { deletedAt: null, status: 'READY' },
    });
    return {
      usedBytes: _sum.sizeBytes ?? 0,
      quotaBytes: this.config.getOrThrow<number>('STORAGE_QUOTA_GB') * 1024 ** 3,
    };
  }

  /**
   * La fila `singleton` la crea el seed, pero el panel no puede depender de que
   * exista: si falta, el estado es IDLE y cero cambios pendientes, que es lo
   * cierto en una base recién levantada.
   */
  private async deploy(): Promise<DeployStateDto> {
    const fila = await this.prisma.deployState.findUnique({
      where: { id: 'singleton' },
      select: { status: true, pendingChanges: true, error: true, finishedAt: true },
    });
    return {
      status: fila?.status ?? 'IDLE',
      pendingChanges: fila?.pendingChanges ?? 0,
      error: fila?.error ?? null,
      finishedAt: fila?.finishedAt?.toISOString() ?? null,
    };
  }

  private async ultimaGaleria(): Promise<DashboardDto['ultimaGaleria']> {
    const g = await this.prisma.gallery.findFirst({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return g ?? null;
  }
}
