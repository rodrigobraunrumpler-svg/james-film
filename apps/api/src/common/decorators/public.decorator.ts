import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * El guard es GLOBAL: lo público se marca, no al revés. Con guard por controller,
 * un módulo nuevo al que se olvide la protección queda abierto; así el olvido
 * produce un 401. Fallar cerrado, no abierto.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
