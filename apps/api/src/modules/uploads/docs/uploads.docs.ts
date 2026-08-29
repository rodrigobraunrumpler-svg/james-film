import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';
import { PresignUploadEntity } from './uploads.entities.js';

export const DocPresignUpload = (): MethodDecorator =>
  ApiDoc({
    summary: 'Firma la subida de una imagen que no es un medio de galería',
    description:
      'Portadas, avatares, capturas, logo, firma, OG y el vídeo del hero. **No crea ninguna ' +
      'fila**: la clave se guarda cuando el `PATCH` de la entidad la incluye. El `proposito` ' +
      'decide el prefijo, los tipos permitidos y el techo de tamaño.',
    ok: PresignUploadEntity,
    status: 201,
    errors: [400],
    auth: true,
  });
