import { ApiProperty } from '@nestjs/swagger';
import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export class PublicacionSolicitadaEntity {
  @ApiProperty({
    description:
      'Siempre `true`. Confirma que se PIDIÓ la reconstrucción, no que el build haya salido bien: ' +
      'para eso haría falta consultar la API de Cloudflare con un token.',
  })
  solicitado!: true;
}

export const DocPublicar = (): MethodDecorator =>
  ApiDoc({
    summary: 'Reconstruye la web ahora, sin esperar el debounce',
    description:
      'Lo llama el botón «Publicar los N cambios» del panel. Se salta los 60 s del ' +
      '`DeployService` a propósito: si James lo pulsa es que ya terminó de editar, y ' +
      'esperar un minuto más le haría dudar de si funcionó.\n\n' +
      '**202, no 200**: se acepta la petición y el build de Astro corre después, fuera ' +
      'de este ciclo. Un 200 prometería que la web ya cambió.',
    ok: PublicacionSolicitadaEntity,
    status: 202,
    auth: true,
  });
