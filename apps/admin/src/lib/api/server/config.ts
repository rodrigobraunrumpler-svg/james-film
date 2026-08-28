import 'server-only';
import { z } from 'zod';

/**
 * SIN `NEXT_PUBLIC_`: estas variables no deben inlinearse en el bundle del
 * navegador. El `server-only` de arriba hace que importar este módulo desde un
 * componente cliente **no compile**, en vez de filtrar la URL interna.
 */
const schema = z.object({
  API_URL: z.url(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

const parsed = schema.safeParse({
  API_URL: process.env.API_URL,
  API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(
    `Configuración inválida del servidor del admin:\n${parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  );
}

export const serverConfig = {
  apiUrl: parsed.data.API_URL.replace(/\/$/, ''),
  timeoutMs: parsed.data.API_TIMEOUT_MS,
} as const;
