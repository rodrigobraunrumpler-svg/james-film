import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/bootstrap.js';
import { construirDocPublico } from '../src/common/swagger/setup.js';

let app: INestApplication;

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

/**
 * Es la sonda que decide si un despliegue sale o se queda parado, así que sus
 * dos propiedades —que no pida sesión y que TOQUE la base— son el contrato.
 */
describe('GET /health', () => {
  it('responde 200 SIN sesión: una sonda no tiene bearer', async () => {
    const { body } = await http().get('/health').expect(200);
    expect(body.data.estado).toBe('ok');
  });

  it('dice la ARQUITECTURA, que es lo que Railway no documenta', async () => {
    // De esto depende que `@node-rs/argon2` cargue su binario: si no coincide,
    // la API arranca, sirve galerías y muere en el primer login.
    const { body } = await http().get('/health').expect(200);
    expect(body.data.arquitectura).toBe(process.arch);
    expect(body.data.plataforma).toBe('linux');
    expect(body.data.node).toMatch(/^24\./);
  });

  it('NO se cuela en el contrato público que el CI congela', () => {
    /*
     * Se construye el DOCUMENTO, no se pide la ruta: `montarSwagger` vive en
     * `main.ts` y los tests arrancan por `configurarApp`, así que aquí no hay
     * Swagger montado y pedir `/docs/public-json` daría 404 por el motivo
     * equivocado. Lo que importa es el documento, que es lo que se congela.
     */
    const doc = construirDocPublico(app);
    expect(Object.keys(doc.paths ?? {})).not.toContain('/health');
  });

  it('el throttler no puede tumbarlo: una sonda insiste', async () => {
    // El límite global son 120/minuto desde la misma IP. Sin `@SkipThrottle`,
    // la vigilancia acabaría tumbando el despliegue que vigila.
    for (let i = 0; i < 12; i++) await http().get('/health').expect(200);
  });
});

/**
 * La UI de Swagger es una página PÚBLICA: el bearer protege los endpoints, no
 * el catálogo. `/docs/admin` publicaba la superficie entera de administración
 * —cada ruta, cada parámetro— a quien la pidiera, y CLAUDE.md dice por escrito
 * que eso no se expone en producción. El código montaba los dos sin condición.
 */
describe('la UI de Swagger de administración', () => {
  const conEntorno = async (valor: string, prueba: (u: string[]) => void) => {
    const previo = process.env.NODE_ENV;
    process.env.NODE_ENV = valor;
    const montadas: string[] = [];
    // Se espía el `use` del adaptador: es donde Swagger registra su ruta, y así
    // no hace falta levantar un segundo servidor por cada caso.
    const { SwaggerModule } = await import('@nestjs/swagger');
    const real = SwaggerModule.setup;
    (SwaggerModule as { setup: unknown }).setup = (ruta: string) => {
      montadas.push(ruta);
    };
    try {
      const { montarSwagger } = await import('../src/common/swagger/setup.js');
      montarSwagger(app);
      prueba(montadas);
    } finally {
      (SwaggerModule as { setup: unknown }).setup = real;
      process.env.NODE_ENV = previo;
    }
  };

  it('en producción NO se monta', async () => {
    await conEntorno('production', (rutas) => {
      expect(rutas).toContain('docs/public');
      expect(rutas, 'la superficie de administración quedó publicada').not.toContain('docs/admin');
    });
  });

  it('fuera de producción sí, que es donde hace falta', async () => {
    await conEntorno('development', (rutas) => {
      expect(rutas).toContain('docs/public');
      expect(rutas).toContain('docs/admin');
    });
  });
});
