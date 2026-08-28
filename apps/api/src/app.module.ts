import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.schema.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Un solo .env en la raíz del monorepo.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: '../../.env' }),
    PrismaModule,
    CommonModule,
  ],
})
export class AppModule {}
