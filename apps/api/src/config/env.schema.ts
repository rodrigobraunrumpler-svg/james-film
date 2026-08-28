import { z } from 'zod';

// Solo las variables que la fase 1 usa de verdad. Cada feature añade las suyas:
// declarar una variable que nadie usa solo consigue que la app no arranque.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Conexión de runtime. En Neon lleva `-pooler`.
  DATABASE_URL: z.url(),
  // Conexión directa. La usan las migraciones (ver prisma7.config.ts).
  DIRECT_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${detail}`);
  }
  return parsed.data;
}
