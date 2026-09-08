import { Body, INestApplication, Patch, Post } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminController } from '../decorators/admin-controller.decorator.js';
import { SinDeploy } from '../decorators/sin-deploy.decorator.js';
import { DeployService } from '../../modules/deploy/deploy.service.js';

/**
 * La cadena ENTERA: `@AdminController` → `applyDecorators` → `UseInterceptors`
 * → DI del interceptor → `marcarCambio`.
 *
 * Un test del interceptor a solas no sirve aquí: lo que se pone en duda es si
 * `UseInterceptors` dentro de un decorador compuesto llega a engancharse, y eso
 * solo lo contesta una petición HTTP de verdad contra el contenedor de Nest.
 */
@AdminController('admin/prueba', { tag: 'prueba' })
class ControllerDePrueba {
  @Patch(':id')
  editar(@Body() cuerpo: unknown) {
    return { ok: true, cuerpo };
  }

  @Post('leer')
  leer() {
    return { ok: true };
  }

  @SinDeploy()
  @Post('presign')
  presign() {
    return { ok: true };
  }
}

describe('TriggerDeployInterceptor por HTTP', () => {
  let app: INestApplication;
  const marcarCambio = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ControllerDePrueba],
      providers: [
        Reflector,
        { provide: DeployService, useValue: { marcarCambio } },
        // Los guards globales del AppModule no están aquí, así que las rutas
        // quedan abiertas: lo que se prueba es el interceptor, no la auth.
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
      ],
    }).compile();

    app = modulo.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    marcarCambio.mockClear();
    await app.close();
  });

  it('un PATCH que va bien cuenta el cambio', async () => {
    await request(app.getHttpServer()).patch('/admin/prueba/abc').send({ title: 'x' }).expect(200);

    expect(marcarCambio).toHaveBeenCalledOnce();
  });

  it('un GET no cuenta nada', async () => {
    await request(app.getHttpServer()).get('/admin/prueba/abc').expect(404);

    expect(marcarCambio).not.toHaveBeenCalled();
  });

  it('un POST marcado con @SinDeploy no cuenta', async () => {
    // Los presign firman una URL y no escriben una fila: contarlos enseñaría
    // «8 cambios» al empezar a subir, antes de que exista ningún medio.
    await request(app.getHttpServer()).post('/admin/prueba/presign').expect(201);

    expect(marcarCambio).not.toHaveBeenCalled();
  });

  it('un POST normal SÍ cuenta', async () => {
    await request(app.getHttpServer()).post('/admin/prueba/leer').expect(201);

    expect(marcarCambio).toHaveBeenCalledOnce();
  });
});
