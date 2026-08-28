import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderDto {
  /** El orden final completo, no un desplazamiento. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
