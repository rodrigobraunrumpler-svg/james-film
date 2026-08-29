import { z } from 'zod';

export const esquemaIdentidad = z.object({
  brandName: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  role: z.string().max(80, 'Máximo 80 caracteres').optional(),
  tagline: z.string().max(160, 'Máximo 160 caracteres').optional(),
  slogan: z.string().max(160, 'Máximo 160 caracteres').optional(),
  aboutText: z.string().max(4000, 'Máximo 4000 caracteres').optional(),
});

export const esquemaContacto = z.object({
  /**
   * Diez dígitos como suelo: un móvil peruano son nueve, y sin el prefijo el
   * botón de la landing no funciona **sin que nada falle**. Mismo criterio que
   * la API, que es la que tiene la última palabra.
   */
  whatsappNumber: z
    .string()
    .regex(/^[1-9]\d{9,14}$/, 'Con prefijo de país y sin «+». Ejemplo: 51994724944')
    .or(z.literal(''))
    .optional(),
  whatsappDisplay: z.string().max(40, 'Máximo 40 caracteres').optional(),
  whatsappMessage: z.string().max(300, 'Máximo 300 caracteres').optional(),
  ctaText: z.string().max(40, 'Máximo 40 caracteres').optional(),
  email: z.email('No es un email válido').or(z.literal('')).optional(),
});

export const esquemaHero = z.object({
  footerTagline: z.string().max(160, 'Máximo 160 caracteres').optional(),
});

export const esquemaSeo = z.object({
  metaTitle: z.string().max(70, 'Máximo 70 caracteres').optional(),
  metaDescription: z.string().max(160, 'Máximo 160 caracteres').optional(),
});

export type DatosIdentidad = z.infer<typeof esquemaIdentidad>;
export type DatosContacto = z.infer<typeof esquemaContacto>;
export type DatosHero = z.infer<typeof esquemaHero>;
export type DatosSeo = z.infer<typeof esquemaSeo>;
