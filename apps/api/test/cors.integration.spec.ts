import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';

/**
 * El CORS existe por UNA razón: `POST /track/whatsapp` lo llama el navegador de
 * quien visita la landing, y sin él el preflight fallaba y el clic —la única
 * métrica del negocio— se perdía en silencio.
 *
 * Estos tests miran las cabeceras de verdad, no que `enableCors` esté escrito.
 */
let app: INestApplication;

const LANDING = 'http://localhost:4321';
const AJENO = 'https://no-es-la-landing.example';

const http = () => request(app.getHttpServer());

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  configurarApp(app as NestExpressApplication);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('CORS', () => {
  it('un preflight desde la landing pasa, con su origen y sin comodín', async () => {
    const res = await http()
      .options('/track/whatsapp')
      .set('Origin', LANDING)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    // El origen concreto, NUNCA `*`: con comodín cualquiera empotra el botón.
    expect(res.headers['access-control-allow-origin']).toBe(LANDING);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('desde un origen que no está en la lista, la cabecera NO viene', async () => {
    const res = await http()
      .options('/track/whatsapp')
      .set('Origin', AJENO)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('`Access-Control-Allow-Credentials` no aparece nunca', async () => {
    // Es lo que conserva «sin superficie de CSRF»: sin credenciales no hay
    // cookie que el navegador mande sola.
    const preflight = await http()
      .options('/track/whatsapp')
      .set('Origin', LANDING)
      .set('Access-Control-Request-Method', 'POST');
    const real = await http().post('/track/whatsapp').set('Origin', LANDING).send({ source: 'hero' });

    expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
    expect(real.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('el POST de verdad también responde con el origen permitido', async () => {
    const res = await http().post('/track/whatsapp').set('Origin', LANDING).send({ source: 'hero' });

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(LANDING);
  });

  it('60 preflights seguidos NO agotan el límite del POST que va detrás', async () => {
    // Si el `OPTIONS` gastara cuota del throttler global, el clic de después se
    // quedaría sin. `enableCors` responde antes que los guards, pero eso se
    // comprueba, no se supone.
    for (let i = 0; i < 60; i++) {
      await http()
        .options('/track/whatsapp')
        .set('Origin', LANDING)
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
    }

    await http().post('/track/whatsapp').set('Origin', LANDING).send({ source: 'hero' }).expect(204);
  });
});
