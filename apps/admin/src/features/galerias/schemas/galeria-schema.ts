import { z } from 'zod';

/**
 * Espejo del `CreateGalleryDto` de la API. La autoridad sigue siendo el servidor
 * (`whitelist` + `forbidNonWhitelisted`); esto solo evita el viaje de ida y vuelta
 * para lo que ya se sabe mal.
 *
 * Vive en el admin y no en `packages/contracts` porque los esquemas de zod son
 * runtime y romperían la propiedad de "solo tipos" del paquete.
 */
export const esquemaGaleria = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  categoryId: z.string().min(1, 'Elige una categoría'),
  // `<input type="date">` da YYYY-MM-DD, que es exactamente lo que espera @db.Date.
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .or(z.literal(''))
    .optional(),
  location: z.string().max(120, 'Máximo 120 caracteres').optional(),
});

export type DatosFormularioGaleria = z.infer<typeof esquemaGaleria>;
