import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { DocListarPaquetesPublicos } from './docs/packages.docs.js';
import { PackagesService } from './packages.service.js';

@ApiTags('paquetes')
@SkipThrottle()
@Public()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @DocListarPaquetesPublicos()
  @Get()
  listar() {
    return this.packages.listarPublicos();
  }
}
