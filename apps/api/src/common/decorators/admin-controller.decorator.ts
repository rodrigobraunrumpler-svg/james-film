import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TriggerDeployInterceptor } from '../interceptors/trigger-deploy.interceptor.js';
import { Roles } from './roles.decorator.js';
import type { UsuarioActual } from './current-user.decorator.js';

export interface OpcionesAdminController {
  /** Etiqueta de Swagger. Sin ella el endpoint cae en el grupo «default». */
  tag: string;
  /**
   * Por defecto **solo ADMIN**, en la misma dirección que el guard global: lo
   * que no se declara queda cerrado, no abierto.
   */
  roles?: UsuarioActual['role'][];
}

/**
 * UN decorador por controller de admin. Lo pedía §5 y no existía: los tres
 * controllers usaban `@Controller('admin/...')` a pelo.
 *
 * Importa porque esta fase pasa de 3 a 7 controllers y la fase 6 tiene que
 * meterles el `TriggerDeployInterceptor`. Con esto es **un fichero**; sin esto,
 * siete — y al que se le olvide **no fallará**: esa pantalla simplemente dejará
 * de marcar cambios sin publicar, y James verá «0 cambios» tras editar precios.
 *
 * Y arregla algo que ya estaba roto: `RolesGuard` está registrado como guard
 * global pero **devolvía `true` en todas las peticiones**, porque ningún
 * controller declaraba `@Roles()`. Era maquinaria muerta con aspecto de
 * protección. Aquí el rol se aplica una vez y no se puede olvidar.
 */
export function AdminController(ruta: string, opciones: OpcionesAdminController): ClassDecorator {
  return applyDecorators(
    Controller(ruta),
    ApiTags(opciones.tag),
    ApiBearerAuth(),
    Roles(...(opciones.roles ?? ['ADMIN'])),
    // AQUÍ, y en ningún otro sitio: cuenta el cambio y agenda el rebuild de la
    // web. Solo actúa sobre métodos que mutan y que hayan ido bien; lo que muta
    // sin cambiar la web lleva `@SinDeploy()`.
    UseInterceptors(TriggerDeployInterceptor),
  );
}
