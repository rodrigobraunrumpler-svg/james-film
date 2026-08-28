import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { requestId } from './common/middleware/request-id.middleware.js';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';

/**
 * La configuración global vive aquí y no en `main.ts` para que los tests de
 * integración prueben el arranque REAL. Si vive solo en main, el test configura
 * una copia y deja de detectar los cambios.
 */
export function configurarApp(app: NestExpressApplication): void {
  // La CSP por defecto de helmet rompe la UI de Swagger (scripts y estilos en
  // línea). Se exceptúa /docs en vez de desactivar la CSP entera.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // El primero de la cadena: el filtro de errores necesita el id aunque falle
  // cualquier cosa después.
  app.use(requestId);

  // "Nunca subas archivos a través de la API" (§4) deja de ser una frase: el
  // presign de ocho archivos ocupa ~2 kb, así que 256 kb es holgadísimo.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '256kb', extended: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //              SEGURIDAD: sin esto alguien manda {isPublished:true}
      forbidNonWhitelisted: true, //   a un endpoint que no debería permitirlo
      transform: true,
      // NO activar enableImplicitConversion: convierte "false" en true.
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Railway y Render mandan SIGTERM en cada redeploy. Sin esto, onModuleDestroy
  // no corre, Prisma no cierra y cada despliegue deja conexiones colgando.
  app.enableShutdownHooks();
}
