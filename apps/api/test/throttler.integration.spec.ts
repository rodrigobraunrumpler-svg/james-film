import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { configurarApp } from '../src/bootstrap.js';
import { Public } from '../src/common/decorators/public.decorator.js';

@Controller('limitado')
class LimitadoController {
  @Public()
  @Get()
  ok() {
    return { ok: true };
  }
}

let app: INestApplication;

/**
 * Módulo propio con límites estáticos y bajos. La suite general corre con
 * RATE_LIMIT_ENABLED=false para no autobloquearse, así que sin este fichero
 * el rate limiting no estaría probado en ningún sitio.
 */
beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [
      // `configurarApp` monta el CORS y exige `WEB_ORIGIN`. Este módulo es un
      // banco de pruebas mínimo que se salta `validateEnv`, así que la variable
      // se pone a mano. Que `getOrThrow` reviente aquí es lo correcto: en la
      // app de verdad, faltar esa variable dejaría el clic sin registrar.
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ WEB_ORIGIN: ['http://localhost:4321'] })],
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 3 }]),
    ],
    controllers: [LimitadoController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('rate limiting', () => {
  it('pasada la cuota devuelve 429 con código RATE_LIMITED, no un 500', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get('/limitado').expect(200);
    }

    const { body } = await request(app.getHttpServer()).get('/limitado').expect(429);

    // Que llegue con `code` significa que el AllExceptionsFilter también
    // normaliza las excepciones del throttler, no solo las nuestras.
    expect(body).toMatchObject({ success: false, statusCode: 429, code: 'RATE_LIMITED' });
    expect(body.requestId).toBeDefined();
  });
});
