import { HttpCode, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { SinDeploy } from '../../common/decorators/sin-deploy.decorator.js';
import { DeployService } from './deploy.service.js';

@AdminController('admin/deploy', { tag: 'admin/publicación' })
export class DeployAdminController {
  constructor(private readonly deploy: DeployService) {}

  /**
   * El botón «Publicar los N cambios» del panel. Se salta el debounce a
   * propósito: si James lo pulsa es que ya terminó de editar, y esperar 60 s
   * más le haría dudar de si funcionó.
   *
   * `@SinDeploy()` porque este POST **es** la publicación: sin él se contaría a
   * sí mismo como un cambio pendiente y el contador nunca llegaría a cero.
   */
  @SinDeploy()
  @HttpCode(202)
  @Post()
  async publicar(): Promise<{ solicitado: true }> {
    await this.deploy.publicar();
    return { solicitado: true };
  }
}
