import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  /**
   * El navegador de la LANDING habla DIRECTAMENTE con la API: el clic a
   * WhatsApp se registra desde ahí. `CLAUDE.md` ya lo anticipaba —«vuelve a
   * hacer falta el día que un navegador hable directamente con la API»—, y sin
   * esto el preflight fallaba y el clic se perdía en silencio: el panel diría
   * «0 clics» y parecería que la web no funciona.
   *
   * Va lo PRIMERO de la cadena para que el `OPTIONS` termine aquí y no gaste
   * cuota del throttler global: si el preflight consume, el `POST` que va
   * detrás se queda sin. Hay test.
   */
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string[]>('WEB_ORIGIN'),
    methods: ['GET', 'POST'],
    /**
     * LO QUE CONSERVA «sin superficie de CSRF»: sin credenciales no hay cookie
     * que el navegador mande sola. El admin sigue yendo por su pasarela, que
     * adjunta el Bearer en el servidor.
     */
    credentials: false,
    maxAge: 86_400,
  });

  // La CSP por defecto de helmet rompe la UI de Swagger (scripts y estilos en
  // línea). Se exceptúa /docs en vez de desactivar la CSP entera.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Lo primero que TOCA una petición de verdad —el CORS de arriba responde al
  // preflight y ya no sigue—: el filtro de errores necesita el id aunque falle
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
