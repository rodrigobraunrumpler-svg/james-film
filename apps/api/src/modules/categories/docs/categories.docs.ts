import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import { AdminCategoryEntity, CategoryEntity } from './categories.entities.js';

export const DocListarCategoriasPublicas = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista las categorías activas',
    description: 'Solo las activas, ordenadas. Sin paginar: son cuatro.',
    okArray: CategoryEntity,
  });

export const DocListarCategoriasAdmin = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista todas las categorías, incluidas las inactivas',
    description:
      'Trae `galleryCount` y `packageCount` para que el aviso de borrado pueda decir cuántas ' +
      'la usan **antes** de pulsar.',
    okArray: AdminCategoryEntity,
    auth: true,
  });

export const DocCrearCategoria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Crea una categoría',
    description: 'El slug se genera del nombre y se desambigua con sufijo si ya existe.',
    ok: AdminCategoryEntity,
    status: 201,
    auth: true,
  });

export const DocActualizarCategoria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Actualiza una categoría',
    description:
      'El slug **no** se regenera al renombrar; se edita a mano y rompe los enlaces ' +
      'compartidos. `null` borra un campo opcional, omitirlo lo deja como está.',
    ok: AdminCategoryEntity,
    errors: [404],
    auth: true,
  });

export const DocBorrarCategoria = (): MethodDecorator =>
  ApiDoc({
    summary: 'Borra una categoría vacía',
    description:
      'Devuelve **409 `CATEGORY_IN_USE`** con el número si aún la usan galerías o paquetes. ' +
      'Los paquetes cuentan aunque Postgres no se queje: el vínculo es Cascade y el borrado ' +
      'los desvincularía en silencio.',
    status: 204,
    errors: [404, 409],
    auth: true,
  });

export const DocReordenarCategorias = (): MethodDecorator =>
  ApiDoc({
    summary: 'Reordena las categorías',
    description: 'Se mandan TODOS los ids: se numera 0..n-1 solo lo que llega.',
    okArray: AdminCategoryEntity,
    auth: true,
  });
