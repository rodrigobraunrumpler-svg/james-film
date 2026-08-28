import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './bootstrap.js';
import { montarSwagger } from './common/swagger/setup.js';

/** Solo en desarrollo: en producción los logs los lee una máquina, no tú. */
function pintarRutas(url: string): void {
  const log = new Logger('James Film');
  log.log(`API        ${url}`);
  log.log(`Swagger    ${url}/docs/public   ← el contrato que consume la landing`);
  log.log(`Swagger    ${url}/docs/admin    ← con bearer, no se expone en producción`);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);
  montarSwagger(app);

  await app.listen(process.env.PORT ?? 3000);

  if (process.env.NODE_ENV !== 'production') {
    // getUrl() devuelve la dirección real, pero como IPv6 (`http://[::1]:3000`),
    // que no es pinchable en la terminal.
    pintarRutas((await app.getUrl()).replace('[::1]', 'localhost'));
  }
}

await bootstrap();
