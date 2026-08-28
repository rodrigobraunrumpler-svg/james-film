import { Body, Controller, Get, type INestApplication, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsString, Length, Min, ValidateNested } from 'class-validator';
import request from 'supertest';
import { configurarApp } from '../src/bootstrap.js';
import { paginar } from '../src/common/pagination.js';

class ItemDto {
  @IsString()
  @Length(2, 60)
  text!: string;
}

class SondaDto {
  @IsString()
  @Length(2, 60)
  title!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}

@Controller('sonda')
class SondaController {
  @Get('recurso')
  recurso() {
    return { id: 'gal_1', title: 'XV de Camila' };
  }

  @Get('lista')
  lista() {
    return paginar([{ id: 'a' }, { id: 'b' }], 47, 2, 20);
  }

  @Get('vacia')
  vacia() {
    return paginar([], 0, 1, 20);
  }

  @Get('sin-contenido')
  sinContenido(): void {}

  @Get('boom')
  boom(): never {
    throw new Error('secreto: SELECT * FROM "User"');
  }

  @Post('validar')
  validar(@Body() dto: SondaDto) {
    return dto;
  }
}

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ controllers: [SondaController] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  // Se configura con la MISMA función que main.ts: si el arranque real cambia,
  // estos tests lo ven.
  configurarApp(app as NestExpressApplication);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('sobre de respuesta', () => {
  it('envuelve un recurso único', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/recurso').expect(200);
    expect(body).toMatchObject({ success: true, code: 'OK', data: { id: 'gal_1' } });
    expect(body.timestamp).toBeDefined();
    expect(body.meta).toBeUndefined();
  });

  it('una lista lleva data y meta', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/lista').expect(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({
      totalCount: 47,
      pageCount: 3,
      currentPage: 2,
      pageSize: 20,
      isFirstPage: false,
      isLastPage: false,
      previousPage: 1,
      nextPage: 3,
    });
  });

  it('lista vacía: pageCount 0, ambos extremos true, vecinos null', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/vacia').expect(200);
    expect(body.meta).toMatchObject({
      pageCount: 0,
      isFirstPage: true,
      isLastPage: true,
      previousPage: null,
      nextPage: null,
    });
  });

  it('un handler sin retorno da data: null, no undefined', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/sin-contenido').expect(200);
    expect(body).toMatchObject({ success: true, data: null });
  });
});

describe('errores', () => {
  it('un error interno NO filtra el mensaje original al cliente', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/boom').expect(500);
    expect(body).toMatchObject({ success: false, code: 'INTERNAL', message: 'Error interno' });
    expect(JSON.stringify(body)).not.toContain('SELECT');
    expect(body.requestId).toBeDefined();
  });

  it('la validación devuelve details por campo, con ruta de puntos en lo anidado', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/sonda/validar')
      .send({ title: 'x', order: -3, items: [{ text: 'correcto' }, { text: 'y' }] })
      .expect(422);

    expect(body.code).toBe('VALIDATION_FAILED');
    const campos = body.details.map((d: { field: string }) => d.field);
    expect(campos).toContain('title');
    expect(campos).toContain('order');
    // Sin la ruta con índice, el formulario no sabe a qué bullet atar el error.
    expect(campos).toContain('items.1.text');
  });

  it('whitelist: un campo no declarado se rechaza, no se ignora', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/sonda/validar')
      .send({ title: 'valido', order: 1, items: [], isPublished: true })
      .expect(422);

    expect(body.details).toContainEqual(
      expect.objectContaining({ field: 'isPublished', code: 'whitelistValidation' }),
    );
  });

  it('superar el límite de cuerpo da 413 con código, no un 500 opaco', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/sonda/validar')
      .send({ title: 'a'.repeat(300_000), order: 1, items: [] })
      .expect(413);

    expect(body.code).toBe('FILE_TOO_LARGE');
  });
});

describe('cabeceras', () => {
  it('helmet pone las cabeceras y quita x-powered-by', async () => {
    const res = await request(app.getHttpServer()).get('/sonda/recurso');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('cada respuesta lleva x-request-id, y respeta el del proxy si viene', async () => {
    const propio = await request(app.getHttpServer()).get('/sonda/recurso');
    expect(propio.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const heredado = await request(app.getHttpServer())
      .get('/sonda/recurso')
      .set('x-request-id', 'traza-del-proxy');
    expect(heredado.headers['x-request-id']).toBe('traza-del-proxy');
  });
});
