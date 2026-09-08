import { Global, Module } from '@nestjs/common';
import { DeployAdminController } from './deploy.admin.controller.js';
import { DeployService } from './deploy.service.js';

/**
 * `@Global` porque el `TriggerDeployInterceptor` lo inyecta desde
 * `@AdminController`, o sea desde los once módulos de admin. Sin esto habría
 * que importar este módulo en cada uno — y al que se le olvidara, su pantalla
 * dejaría de marcar cambios sin publicar sin dar ningún error.
 */
@Global()
@Module({
  controllers: [DeployAdminController],
  providers: [DeployService],
  exports: [DeployService],
})
export class DeployModule {}
