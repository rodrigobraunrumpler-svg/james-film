import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator.js';
import { ReorderDto } from '../../common/dto/reorder.dto.js';
import {
  DocActualizarPaquete,
  DocBorrarPaquete,
  DocCrearPaquete,
  DocDestacarPaquete,
  DocListarPaquetesAdmin,
  DocReordenarPaquetes,
} from './docs/packages.docs.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';
import { PackagesService } from './packages.service.js';

@AdminController('admin/packages', { tag: 'admin/paquetes' })
export class PackagesAdminController {
  constructor(private readonly packages: PackagesService) {}

  @DocListarPaquetesAdmin()
  @Get()
  listar() {
    return this.packages.listarTodos();
  }

  @DocCrearPaquete()
  @Post()
  crear(@Body() dto: CreatePackageDto) {
    return this.packages.crear(dto);
  }

  /** ANTES de `@Patch(':id')`: si no, `:id` captura «reorder». Con test. */
  @DocReordenarPaquetes()
  @Patch('reorder')
  reordenar(@Body() dto: ReorderDto) {
    return this.packages.reordenar(dto.ids);
  }

  @DocActualizarPaquete()
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packages.actualizar(id, dto);
  }

  @DocDestacarPaquete()
  @Patch(':id/highlight')
  destacar(@Param('id') id: string) {
    return this.packages.destacar(id);
  }

  @DocBorrarPaquete()
  @HttpCode(204)
  @Delete(':id')
  borrar(@Param('id') id: string): Promise<void> {
    return this.packages.borrar(id);
  }
}
