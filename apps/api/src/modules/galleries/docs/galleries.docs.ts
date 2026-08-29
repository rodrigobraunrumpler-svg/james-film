import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import {
  AdminGalleryListItemEntity,
  GalleryCountsEntity,
  GalleryEntity,
  GalleryListItemEntity,
} from './galleries.entities.js';

// --- público ---

export const DocListarGalerias = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista las galerías publicadas',
    description:
      'Solo publicadas y sin borrar. **No devuelve los medios**, solo `mediaCount`: ' +
      'incluirlos haría que el build de Astro se trajera todos los reels de todas ' +
      'las galerías en una respuesta que crece sin techo. Usa el detalle por slug.',
    paginated: GalleryListItemEntity,
  });

export const DocGaleriaPorSlug = (): MethodDecorator =>
  ApiDoc({
    summary: 'Devuelve una galería publicada con sus medios',
    description:
      'Solo los medios en READY. Una galería sin publicar devuelve **404 y no 403**: ' +
      'un 403 confirmaría que ese enlace existe.',
    ok: GalleryEntity,
    errors: [404],
  });

// --- admin ---

export const DocListarGaleriasAdmin = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista todas las galerías, incluidos los borradores',
    description: 'Filtra con `?estado=todas|publicadas|borradores` y busca en el título con `?q=`.',
    paginated: AdminGalleryListItemEntity,
    auth: true,
  });

export const DocContarGalerias = (): MethodDecorator =>
  ApiDoc({
    summary: 'Cuenta las galerías por estado, para las pestañas',
    description:
      'Endpoint propio porque los recuentos NO dependen del filtro activo: ' +
      'devolverlos en la lista filtrada obligaría a recalcularlos en cada página.',
    ok: GalleryCountsEntity,
    auth: true,
  });

export const DocGaleriaPorId = (): MethodDecorator =>
  ApiDoc({ summary: 'Devuelve una galería por id', ok: GalleryEntity, errors: [404], auth: true });

export const DocCrearGaleria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Crea una galería',
    description:
      'El slug se genera del título. Si ya existe —incluso de una galería borrada, ' +
      'porque el índice no es parcial— se desambigua con sufijo numérico.',
    ok: GalleryEntity,
    status: 201,
    errors: [409, 422],
    auth: true,
  });

export const DocActualizarGaleria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Actualiza una galería',
    description:
      '**El slug NO se regenera al renombrar.** James comparte enlaces por WhatsApp ' +
      'a diario y regenerarlo los rompería todos en silencio.',
    ok: GalleryEntity,
    errors: [404, 422],
    auth: true,
  });

export const DocBorrarGaleria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Borra una galería (soft delete)',
    description:
      'Marca `deletedAt` y lo propaga a sus medios en la misma transacción. Los ' +
      'archivos siguen en el bucket hasta que el cron los purgue a los 30 días.',
    status: 204,
    errors: [404],
    auth: true,
  });

export const DocReordenarMedios = (): MethodDecorator =>
  ApiDoc({
    summary: 'Reordena los medios de una galería',
    description: 'Se manda el orden final completo, no un desplazamiento.',
    ok: GalleryEntity,
    errors: [404, 422],
    auth: true,
  });

export const DocMarcarPortada = (): MethodDecorator =>
  ApiDoc({
    summary: 'Marca un medio como portada',
    description: 'Exclusiva **por galería**: no afecta a la portada de otras.',
    ok: GalleryEntity,
    errors: [404],
    auth: true,
  });
