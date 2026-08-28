import { z } from 'zod';

/**
 * En Next las variables de cliente se inlinean en build: hay que nombrarlas
 * enteras, `process.env[nombre]` no funciona.
 *
 * Aquí NO va la URL de la API: el navegador habla con su propio origen y solo el
 * servidor conoce el destino real (ver `lib/api/server/config.ts`).
 */
const schema = z.object({
  NEXT_PUBLIC_API_BASE: z.string().startsWith('/').default('/api'),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(
    `Configuración inválida del admin:\n${parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
}

export const config = {
  base: parsed.data.NEXT_PUBLIC_API_BASE,
  timeoutMs: parsed.data.NEXT_PUBLIC_API_TIMEOUT_MS,
} as const;
