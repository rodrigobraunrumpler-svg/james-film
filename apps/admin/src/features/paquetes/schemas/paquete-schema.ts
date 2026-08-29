import { z } from 'zod';

export const esquemaItem = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'No puede estar vacío').max(200, 'Máximo 200 caracteres'),
  included: z.boolean(),
});

export const esquemaPaquete = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  subtitle: z.string().max(120, 'Máximo 120 caracteres').optional(),
  /**
   * Soles ENTEROS, y se valida como CADENA porque eso es lo que da un
   * `<input>`. Con `z.coerce.number()` el tipo de entrada del formulario deja
   * de coincidir con el de salida y `useForm` no acepta el resolver.
   *
   * `step="1"` no valida nada: el navegador deja teclear `300.5` y aquí no hay
   * submit nativo. La conversión a céntimos va en el envío, y la última palabra
   * la tiene la API.
   */
  precioSoles: z.string().regex(/^\d*$/, 'Solo soles enteros, sin decimales').optional(),
  priceNote: z.string().max(120, 'Máximo 120 caracteres').optional(),
  idealFor: z.string().max(120, 'Máximo 120 caracteres').optional(),
  icon: z.string().optional(),
  badgeText: z.string().max(40, 'Máximo 40 caracteres').optional(),
  whatsappMessage: z.string().max(300, 'Máximo 300 caracteres').optional(),
  items: z.array(esquemaItem).max(30, 'Máximo 30 puntos'),
  categoryIds: z.array(z.string()),
});

export type DatosFormularioPaquete = z.infer<typeof esquemaPaquete>;
