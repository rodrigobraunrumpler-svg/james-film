import { ApiPropertyOptional } from '@nestjs/swagger';
import type { IsoDate, TrackWhatsappClickInput, WhatsappSource } from '@james-film/contracts';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** De dónde salió el clic. Lista cerrada: un `source` con typo no agrupa nada. */
export const FUENTES = [
  'hero',
  // La barra superior y el menú desplegable NO son el hero: mandaban los tres
  // `hero` y eso hacía que cualquier cambio en la primera pantalla saliera
  // igual en el panel, porque se estaban sumando tres botones distintos.
  'barra',
  'menu',
  'paquetes',
  'footer',
  'galeria',
  // El calendario distingue las dos: preguntar por un día LIBRE y preguntar
  // porque el tuyo está ocupado son intenciones distintas, y saber cuántos
  // llegan por la segunda es lo que dice si el calendario está haciendo su
  // trabajo. Van aquí y no en el código de la web: `@IsIn` es una lista
  // cerrada, y una fuente que no esté da 422 y pierde el clic sin ruido.
  'calendario-libre',
  'calendario-ocupado',
  // La línea de publicidad para negocios: otro público, otro mensaje y otro
  // CTA. Contarla aparte es lo único que dirá si esa mitad del negocio vende.
  'negocios',
] as const;

export class TrackClickDto implements TrackWhatsappClickInput {
  @ApiPropertyOptional({ description: 'Qué paquete miraba. Se ignora si ya no existe.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  packageId?: string;

  @ApiPropertyOptional({ enum: FUENTES })
  @IsOptional()
  @IsIn(FUENTES)
  // El tipo lo pone el CONTRATO, no `string`: si `FUENTES` y la unión se
  // separan, esto deja de compilar en vez de devolver 422 en producción.
  source?: WhatsappSource;

  /**
   * El día por el que preguntaba, si venía del calendario.
   *
   * Se valida la FORMA (`YYYY-MM-DD`) y nada más: no se comprueba que exista ni
   * que esté dentro de la ventana. Este endpoint es público y **el clic es el
   * lead**: rechazarlo por un dato accesorio sería cambiar la única métrica del
   * negocio por un detalle. Lo que no puede es entrar cualquier cadena, porque
   * de aquí sale un `@db.Date`.
   */
  @ApiPropertyOptional({ example: '2026-10-24', description: 'Solo desde el calendario' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'la fecha va en formato YYYY-MM-DD' })
  requestedDate?: IsoDate | null;
}
