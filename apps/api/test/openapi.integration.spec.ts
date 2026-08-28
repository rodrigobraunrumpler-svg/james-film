import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { construirDocAdmin, construirDocPublico } from '../src/common/swagger/setup.js';

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication<NestExpressApplication>();
  await app.init();
});

afterAll(async () => {
  await app.close();
});

interface Operacion {
  summary?: string;
  responses?: Record<string, unknown>;
}

const operaciones = (doc: OpenAPIObject) =>
  Object.entries(doc.paths).flatMap(([ruta, ops]) =>
    Object.entries(ops as Record<string, Operacion>).map(([metodo, op]) => ({ ruta, metodo, op })),
  );

describe('documentación', () => {
  it('el doc público NO contiene ninguna ruta de admin', () => {
    // `include: [GalleriesModule]` mete el módulo entero, y ese módulo tiene los
    // dos controllers: sin la poda, el contrato que consume Astro documentaría
    // la superficie privada al completo.
    const rutas = Object.keys(construirDocPublico(app).paths);
    expect(rutas.filter((r) => r.includes('/admin'))).toEqual([]);
    expect(rutas.length).toBeGreaterThan(0);
  });

  it('el doc público no arrastra esquemas de escritura', () => {
    const esquemas = Object.keys(construirDocPublico(app).components?.schemas ?? {});
    expect(esquemas).not.toContain('CreateGalleryDto');
    expect(esquemas).not.toContain('UpdateGalleryDto');
  });

  it('todo endpoint tiene summary: nada sin documentar', () => {
    const sinDocumentar = operaciones(construirDocAdmin(app))
      .filter(({ op }) => !op.summary)
      .map(({ metodo, ruta }) => `${metodo.toUpperCase()} ${ruta}`);

    expect(sinDocumentar).toEqual([]);
  });

  it('todo endpoint autenticado declara el 401', () => {
    const sinCubrir = operaciones(construirDocAdmin(app))
      .filter(({ ruta }) => ruta.startsWith('/admin'))
      .filter(({ op }) => !op.responses?.['401'])
      .map(({ metodo, ruta }) => `${metodo.toUpperCase()} ${ruta}`);

    expect(sinCubrir).toEqual([]);
  });

  it('el contrato público congelado sigue igual', () => {
    // Mismo mecanismo que el drift de Prisma, aplicado a la frontera con la
    // landing: si cambia sin querer, la web se rompe en el siguiente deploy y
    // el error aparece lejos de la causa.
    const actual = construirDocPublico(app);
    const congelado = JSON.parse(
      readFileSync(new URL('../docs/openapi-public.json', import.meta.url), 'utf8'),
    ) as typeof actual;

    expect(actual.paths).toEqual(congelado.paths);
    expect(actual.components?.schemas).toEqual(congelado.components?.schemas);
  });
});
