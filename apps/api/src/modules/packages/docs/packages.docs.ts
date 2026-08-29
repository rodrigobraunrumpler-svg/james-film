import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import { AdminPackageEntity, PackageEntity } from './packages.entities.js';

export const DocListarPaquetesPublicos = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista los paquetes activos',
    description:
      'El destacado sale primero, **sin salirse de la lista**: la landing decide cómo pintarlo.',
    okArray: PackageEntity,
  });

export const DocListarPaquetesAdmin = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista todos los paquetes, incluidos los inactivos',
    okArray: AdminPackageEntity,
    auth: true,
  });

export const DocCrearPaquete = (): MethodDecorator =>
  ApiDoc({
    summary: 'Crea un paquete con sus puntos y categorías',
    ok: AdminPackageEntity,
    status: 201,
    auth: true,
  });

export const DocActualizarPaquete = (): MethodDecorator =>
  ApiDoc({
    summary: 'Actualiza un paquete',
    description:
      '`items` llega **completo y en orden**: se actualizan los que traen `id`, se crean los ' +
      'que no y se borran los que faltan, todo en una transacción. Un `id` de otro paquete se ' +
      'rechaza. `categoryIds` reemplaza los vínculos enteros.',
    ok: AdminPackageEntity,
    errors: [400, 404],
    auth: true,
  });

export const DocDestacarPaquete = (): MethodDecorator =>
  ApiDoc({
    summary: 'Marca el paquete destacado',
    description: 'Exclusivo GLOBAL: marcar uno desmarca el resto.',
    ok: AdminPackageEntity,
    errors: [404],
    auth: true,
  });

export const DocBorrarPaquete = (): MethodDecorator =>
  ApiDoc({
    summary: 'Borra un paquete sin clics registrados',
    description:
      'Con clics atribuidos devuelve **400**: borrarlo pondría su `packageId` a `null` en cada ' +
      'uno, y son la única métrica de negocio del proyecto. La acción correcta es desactivarlo.',
    status: 204,
    errors: [400, 404],
    auth: true,
  });

export const DocReordenarPaquetes = (): MethodDecorator =>
  ApiDoc({ summary: 'Reordena los paquetes', okArray: AdminPackageEntity, auth: true });
