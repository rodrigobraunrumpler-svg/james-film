import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './bootstrap.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
