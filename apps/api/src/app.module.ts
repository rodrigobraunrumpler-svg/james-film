import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { validateEnv } from './config/env.schema.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GalleriesModule } from './modules/galleries/galleries.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    // Un solo .env en la raíz del monorepo.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: '../../.env' }),
    // Global además del estricto del login: un endpoint público sin límite es
    // una invitación, y /track/whatsapp de la fase 6 lo necesitará igual.
    // Se apaga por entorno para que la suite de tests no se autobloquee; el
    // comportamiento tiene su propio test con límites estáticos.
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: () => !config.getOrThrow<boolean>('RATE_LIMIT_ENABLED'),
      }),
    }),
    PrismaModule,
    CommonModule,
    StorageModule,
    AuthModule,
    GalleriesModule,
    MediaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guard GLOBAL: lo público se marca con @Public(). Al revés, un módulo nuevo
    // al que se olvide la protección quedaría abierto.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
