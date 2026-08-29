import { z } from 'zod';

/**
 * Espejo del `CreateCategoryDto`. La autoridad sigue siendo el servidor
 * (`whitelist` + `forbidNonWhitelisted`); esto evita el viaje de ida y vuelta
 * para lo que ya se sabe mal.
 */
export const esquemaCategoria = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  slug: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  tagline: z.string().max(160, 'Máximo 160 caracteres').optional(),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  metaTitle: z.string().max(70, 'Máximo 70 caracteres').optional(),
  metaDescription: z.string().max(160, 'Máximo 160 caracteres').optional(),
});

export type DatosFormularioCategoria = z.infer<typeof esquemaCategoria>;
