import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /**
   * SIN mínimo de longitud a propósito. La política de contraseñas pertenece al
   * registro o al cambio, no al login: aquí solo se verifica. Con un mínimo, una
   * contraseña corta daría 422 en vez de 401 — una respuesta distinta según la
   * longitud de lo que el atacante prueba, y un mensaje que no es el que el
   * usuario necesita ver.
   *
   * El máximo sí se queda: argon2 sobre una cadena de 10 MB es una denegación
   * de servicio gratis.
   */
  @IsString()
  @MaxLength(128)
  password!: string;
}
