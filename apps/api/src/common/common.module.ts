import { Global, Module } from '@nestjs/common';
import { ExclusiveFlagService } from './services/exclusive-flag.service.js';
import { ReorderService } from './services/reorder.service.js';
import { SlugService } from './services/slug.service.js';

@Global()
@Module({
  providers: [SlugService, ReorderService, ExclusiveFlagService],
  exports: [SlugService, ReorderService, ExclusiveFlagService],
})
export class CommonModule {}
