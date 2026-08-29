import { z } from 'zod';

export const esquemaTestimonio = z.object({
  authorName: z.string().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  format: z.enum(['TEXT', 'SCREENSHOT']),
  source: z.enum(['WHATSAPP', 'INSTAGRAM', 'TIKTOK', 'DIRECTO']),
  authorHandle: z.string().max(80, 'Máximo 80 caracteres').optional(),
  eventType: z.string().max(60, 'Máximo 60 caracteres').optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .or(z.literal(''))
    .optional(),
  quote: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  // `z.url()`, no `z.string().url()`: lo segundo está deprecado en Zod 4 y el
  // linter con `no-deprecated` lo rechaza — que es exactamente para lo que está.
  externalUrl: z.url('No es una URL válida').or(z.literal('')).optional(),
  /** Cadena porque eso es lo que da un `<select>`; se convierte al enviar. */
  rating: z.enum(['', '1', '2', '3', '4', '5']).optional(),
});

export type DatosFormularioTestimonio = z.infer<typeof esquemaTestimonio>;
