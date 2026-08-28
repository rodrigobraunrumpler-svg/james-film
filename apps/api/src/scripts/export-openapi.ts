/**
 * OJO: se ejecuta desde `dist/`, NO con tsx. `tsx` usa esbuild y NO emite
 * `emitDecoratorMetadata`, así que la inyección por tipo de NestJS devuelve
 * `undefined` y el arranque revienta sin decir por qué.
 *
 * Congela el contrato público en docs/openapi-public.json. El CI compara y falla
 * si cambia sin querer: es el mismo mecanismo que el drift de Prisma, aplicado a
 * la frontera con la landing.
 */
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module.js';
import { construirDocPublico } from '../common/swagger/setup.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["error"] });
await app.init();

const doc = construirDocPublico(app);
writeFileSync(
  new URL('../../docs/openapi-public.json', import.meta.url),
  `${JSON.stringify(doc, null, 2)}\n`,
);

await app.close();
console.log(`Contrato público congelado: ${Object.keys(doc.paths).length} rutas.`);
