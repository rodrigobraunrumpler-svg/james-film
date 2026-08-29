import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class PackageItemInputDto {
  /**
   * Si viene, se actualiza ese bullet; si no, se crea. **Se comprueba que
   * pertenece a ESTE paquete antes de escribir**: no hay índice único
   * `(id, packageId)` que lo impida, y un id ajeno movería el bullet de sitio.
   */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  id?: string;

  @IsString()
  @Length(1, 200)
  text!: string;

  @IsOptional()
  @IsBoolean()
  included?: boolean;
}
