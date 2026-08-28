import { z } from 'zod';

/**
 * SIN mínimo de longitud, igual que el DTO de la API: la política de contraseñas
 * pertenece al registro, no al login. Con un mínimo, una contraseña corta daría
 * un error de formato en vez de "credenciales incorrectas".
 */
export const esquemaLogin = z.object({
  email: z.email('Escribe un email válido'),
  password: z.string().min(1, 'Escribe tu contraseña').max(128),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
