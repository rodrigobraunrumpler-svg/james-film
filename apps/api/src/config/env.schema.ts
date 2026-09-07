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

  // --- Auth (fase 2) ---
  JWT_SECRET: z.string().min(32),
  /** En segundos. Un número no tiene la ambigüedad de parseo de "15m". */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /**
   * Ventana en la que un refresh ya rotado se acepta en vez de revocar la sesión.
   * En serverless no hay single-flight posible entre invocaciones: dos peticiones
   * concurrentes de la pasarela refrescarían a la vez y la rotación lo leería como
   * reuso. Ver CLAUDE.md.
   */
  REFRESH_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(30),

  /**
   * Los orígenes de la LANDING que pueden hablar con la API desde el navegador.
   * Lista separada por comas, sin `*`.
   *
   * El único que la necesita es `POST /track/whatsapp`: el clic a WhatsApp lo
   * registra el navegador de quien visita, y con `Content-Type: application/json`
   * eso dispara un preflight. La lista blanca no para a un atacante decidido
   * —CORS no detiene a `curl`— sino a quien empotre el botón en otra web e infle
   * los clics.
   *
   * Se normaliza a `origin`: `http://localhost:4321/` y `.../algo` son el mismo
   * origen para el navegador, pero `enableCors` compara la cadena tal cual, y
   * una barra de más dejaría el CORS roto sin decir por qué.
   */
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:4321')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1))
    .transform((lista) => lista.map((o) => new URL(o).origin)),

  // --- Rate limiting ---
  // OJO: `z.coerce.boolean()` convierte la cadena "false" en `true`. Es la misma
  // trampa por la que no activamos enableImplicitConversion en el ValidationPipe.
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // --- Almacenamiento (fase 2) ---
  // MinIO en local y CI, R2 en producción: mismo SDK, solo cambia el endpoint.
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO exige path-style; R2 lo tolera. */
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /** Lo lee SOLO StorageService. Ningún servicio conoce el dominio. */
  CDN_BASE_URL: z.url(),

  MAX_VIDEO_MB: z.coerce.number().int().positive().default(200),
  MAX_IMAGE_MB: z.coerce.number().int().positive().default(15),
  PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /**
   * El plan gratuito de R2 son 10 GB. Es el techo que pinta el medidor del
   * sidebar; no lo aplica nadie todavía —subir por encima seguiría funcionando
   * y lo cobraría Cloudflare—, así que es información, no una cuota.
   */
  STORAGE_QUOTA_GB: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${detail}`);
  }
  return parsed.data;
}
