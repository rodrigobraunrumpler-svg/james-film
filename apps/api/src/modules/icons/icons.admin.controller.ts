import { Get } from '@nestjs/common';
import { ApiDoc } from '../../common/swagger/api-doc.decorator.js';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ICONOS } from '../../common/iconos.js';

/**
 * De admin, NO público: el contrato público está congelado en CI y lo consume
 * Astro. Una ruta pública que solo usa el admin lo movería sin que nadie en la
 * landing la llegue a pedir jamás.
 */
@AdminController('admin/icons', { tag: 'admin/íconos' })
export class IconsAdminController {
  @ApiDoc({
    summary: 'Los nombres de ícono permitidos',
    description:
      'Lista cerrada de lucide. La API valida contra ella, así que aquí no es una copia: ' +
      'es la fuente. Quince cadenas que cambian una vez al año — `staleTime: Infinity`.',
    okArray: String,
    auth: true,
  })
  @Get()
  listar(): readonly string[] {
    return ICONOS;
  }
}
