import { Body, Controller, Get, type INestApplication, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client.js';
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

  /**
   * La base caída, tal y como llega de Prisma 7. Se lanza la CLASE de verdad,
   * no un `Error` con un `code` pegado: el filtro decide con `instanceof`, así
   * que un error fabricado a mano cae en la rama de «desconocido» y el test
   * comprobaría lo contrario de lo que dice comprobar.
   *
   * En local esto es Docker cerrado; en producción, el arranque en frío de Neon.
   */
  @Get('sin-base')
  sinBase(): never {
    throw new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
      code: 'P1001',
      clientVersion: VERSION_PRISMA,
      meta: { modelName: 'User', driverAdapterError: { kind: 'DatabaseNotReachable' } },
    });
  }

  @Get('pool-lleno')
  poolLleno(): never {
    throw new Prisma.PrismaClientKnownRequestError('Timed out fetching a connection', {
      code: 'P2024',
      clientVersion: VERSION_PRISMA,
    });
  }

  @Post('validar')
  validar(@Body() dto: SondaDto) {
    return dto;
  }
}

/** Solo lo pide el constructor del error; no lo mira nadie. */
const VERSION_PRISMA = '7.10.0';

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    // `configurarApp` monta el CORS y exige `WEB_ORIGIN`. Esta sonda no carga
    // `AppModule`, así que se le da la variable a mano. Que `getOrThrow`
    // reviente si falta es lo correcto: en la app de verdad, no tenerla dejaría
    // el clic a WhatsApp sin registrar y en silencio.
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ WEB_ORIGIN: ['http://localhost:4321'] })],
      }),
    ],
    controllers: [SondaController],
  }).compile();
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

describe('la base caída no es un «error interno»', () => {
  it('P1001 sale como 503 y dice qué hacer, no «Error interno»', async () => {
    // 503, no 500: no es que algo haya reventado dentro, es que no hay con
    // quién hablar. Un 500 no sugiere reintentar; un 503 es temporal por
    // definición, y el cliente del admin ya reintenta lo que es ≥500.
    const { body } = await request(app.getHttpServer()).get('/sonda/sin-base').expect(503);

    expect(body.success).toBe(false);
    expect(body.message).toMatch(/base de datos no responde/i);
    expect(body.message).toMatch(/vuelve a intentarlo/i);
    // En producción es el arranque en frío de Neon: con «Error interno», la
    // primera visita del día parecía un fallo de código.
    expect(body.message).not.toBe('Error interno');
  });

  it('el pool saturado también es 503, no 500', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/pool-lleno').expect(503);
    expect(body.message).toMatch(/saturado/i);
  });

  it('y nunca se filtra el detalle de Prisma al cliente', async () => {
    const { body } = await request(app.getHttpServer()).get('/sonda/sin-base').expect(503);
    expect(JSON.stringify(body)).not.toMatch(/DatabaseNotReachable|127\.0\.0\.1|5433/);
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
