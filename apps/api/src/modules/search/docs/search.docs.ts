import { ApiProperty } from '@nestjs/swagger';
import type { SearchKind, SearchResultDto } from '@james-film/contracts';
import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export class SearchResultEntity implements SearchResultDto {
  @ApiProperty({ enum: ['GALLERY', 'PACKAGE', 'CATEGORY', 'TESTIMONIAL'] }) kind!: SearchKind;
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: String, nullable: true }) hint!: string | null;
  @ApiProperty({ example: '/galerias/clx…' }) href!: string;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
}

export const DocBuscar = (): MethodDecorator =>
  ApiDoc({
    summary: 'El buscador de ⌘K: galerías, paquetes, categorías y testimonios',
    description:
      'Cuatro de cada tipo, planos y en un solo array. No es una pantalla de ' +
      'resultados: es para llegar a algo que ya sabes que existe.\n\n' +
      'En el servidor y no en el cliente **porque la lista de galerías viene ' +
      'paginada**: filtrar la página cargada encontraría solo lo que ya estaba ' +
      'en pantalla, que es justo lo que no hace falta buscar.',
    okArray: SearchResultEntity,
    errors: [422],
    auth: true,
  });
