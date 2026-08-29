import { IsIn, IsInt, IsString, Min } from 'class-validator';
import type { PresignUploadInput, UploadPurpose } from '@james-film/contracts';
import { PROPOSITOS } from '../uploads.rules.js';

const NOMBRES = Object.keys(PROPOSITOS);

export class PresignUploadDto implements PresignUploadInput {
  /** Lista cerrada. De aquí sale el prefijo, y por eso no lo manda el cliente. */
  @IsIn(NOMBRES)
  proposito!: UploadPurpose;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
