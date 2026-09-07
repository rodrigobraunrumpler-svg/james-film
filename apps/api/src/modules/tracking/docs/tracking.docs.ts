import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export const DocTrackClic = (): MethodDecorator =>
  ApiDoc({
    summary: 'Registra un clic al botón de WhatsApp',
    description:
      'El clic a WhatsApp **es** el lead: no hay formulario de contacto (§1 §9). ' +
      'Devuelve 204 y no bloquea nada — la landing lo manda con `sendBeacon` y ' +
      'se va a WhatsApp sin esperar.\n\n' +
      'Un `packageId` que ya no existe **no tumba el clic**: se guarda sin ' +
      'atribución. Perder de qué paquete venía es barato; perder el clic no.',
    status: 204,
    errors: [422],
  });
