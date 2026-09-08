import { SetMetadata } from '@nestjs/common';

export const SIN_DEPLOY = 'sinDeploy';

/**
 * Marca un endpoint que muta pero **no cambia lo que la web enseña**, para que
 * no cuente como «cambio sin publicar» ni dispare un rebuild.
 *
 * Hoy son los presign: firman una URL y no escriben una sola fila. Contarlos
 * inflaría el contador que James lee —«8 cambios» al empezar a subir, antes de
 * que exista ningún medio— y gastaría un build de Astro para nada.
 */
export const SinDeploy = (): MethodDecorator => SetMetadata(SIN_DEPLOY, true);
