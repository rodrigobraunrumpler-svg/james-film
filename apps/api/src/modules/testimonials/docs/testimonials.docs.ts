import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import { AdminTestimonialEntity, TestimonialEntity } from './testimonials.entities.js';

export const DocListarTestimoniosPublicos = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista los testimonios publicables',
    description:
      'Solo `isActive` **Y `hasConsent`**. `hasConsent` no sale en el contrato: si un ' +
      'testimonio llega aquí, es que ya lo tenía. Ningún parámetro desactiva ese filtro.',
    okArray: TestimonialEntity,
  });

export const DocListarTestimoniosAdmin = (): MethodDecorator =>
  ApiDoc({
    summary: 'Lista todos los testimonios, incluidos los borradores',
    okArray: AdminTestimonialEntity,
    auth: true,
  });

export const DocCrearTestimonio = (): MethodDecorator =>
  ApiDoc({
    summary: 'Crea un testimonio',
    description: 'Nace en borrador. Publicarlo de entrada exige `hasConsent: true`.',
    ok: AdminTestimonialEntity,
    status: 201,
    errors: [422],
    auth: true,
  });

export const DocActualizarTestimonio = (): MethodDecorator =>
  ApiDoc({
    summary: 'Actualiza un testimonio',
    description:
      'Devuelve **422 `CONSENT_REQUIRED`** si el estado resultante sería publicado sin ' +
      'consentimiento — incluido quitarle el consentimiento a uno ya publicado.',
    ok: AdminTestimonialEntity,
    errors: [404, 422],
    auth: true,
  });

export const DocDestacarTestimonio = (): MethodDecorator =>
  ApiDoc({
    summary: 'Marca el testimonio destacado',
    description: 'Exclusivo: uno solo. Destacar NO publica.',
    ok: AdminTestimonialEntity,
    errors: [404],
    auth: true,
  });

export const DocBorrarTestimonio = (): MethodDecorator =>
  ApiDoc({
    summary: 'Borra un testimonio y su captura',
    description:
      'Borrado DURO, y se lleva la captura del bucket: una captura de WhatsApp con el nombre ' +
      'y la cara de una clienta no debe sobrevivir treinta días a que se decida quitarla.',
    status: 204,
    errors: [404],
    auth: true,
  });

export const DocReordenarTestimonios = (): MethodDecorator =>
  ApiDoc({ summary: 'Reordena los testimonios', okArray: AdminTestimonialEntity, auth: true });
