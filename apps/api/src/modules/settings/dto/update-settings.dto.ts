import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  brandName?: string;

  @IsOptional() @IsString() @MaxLength(80) role?: string | null;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(160) slogan?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) aboutText?: string | null;

  @IsOptional() @IsString() @MaxLength(255) photoKey?: string | null;
  @IsOptional() @IsString() @MaxLength(255) logoKey?: string | null;
  @IsOptional() @IsString() @MaxLength(255) signatureKey?: string | null;

  /**
   * 🔴 El campo más importante del producto. Formato internacional **SIN el
   * `+`**, listo para `wa.me/`: `51994724944`.
   *
   * Sin prefijo el botón de la landing no funciona **y no hay forma de que
   * nadie se entere**: no falla, simplemente nadie escribe nunca. Por eso se
   * valida aquí y no solo en el formulario.
   */
  @IsOptional()
  // 10 dígitos como SUELO, no 8: un móvil peruano son 9 (`994724944`) y con el
  // mínimo anterior pasaba tal cual — que es justo el fallo que esto tiene que
  // impedir. Con el prefijo son 11. El techo son los 15 de E.164.
  //
  // No pretende ser un validador E.164 general: es la comprobación concreta de
  // que el número lleva prefijo de país, porque sin él el botón no funciona y
  // nadie se entera.
  @Matches(/^[1-9]\d{9,14}$/, {
    message:
      'El número va en formato internacional y sin el «+»: para Perú, 51 seguido del número. ' +
      'Por ejemplo 51994724944.',
  })
  whatsappNumber?: string | null;

  @IsOptional() @IsString() @MaxLength(40) whatsappDisplay?: string | null;
  @IsOptional() @IsString() @MaxLength(300) whatsappMessage?: string | null;
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string | null;

  @IsOptional() @IsEmail({}, { message: 'No es un email válido' }) email?: string | null;

  @IsOptional() @IsString() @MaxLength(255) heroMediaKey?: string | null;
  @IsOptional() @IsString() @MaxLength(255) heroPosterKey?: string | null;
  @IsOptional() @IsString() @MaxLength(160) footerTagline?: string | null;

  @IsOptional() @IsString() @MaxLength(70) metaTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(160) metaDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(255) ogImageKey?: string | null;
}
