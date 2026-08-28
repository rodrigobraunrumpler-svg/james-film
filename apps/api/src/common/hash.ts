import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id con los parámetros recomendados por OWASP.
 * 19 MiB de memoria entra de sobra en un contenedor de 512 MB.
 *
 * Esto es SOLO para contraseñas. Los refresh tokens usan SHA-256: argon2 lleva
 * sal aleatoria, así que dos hashes del mismo token difieren y un
 * `WHERE tokenHash = ?` no encontraría nunca la fila.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string): Promise<string> => hash(plain, OPTIONS);

export const verifyPassword = (digest: string, plain: string): Promise<boolean> =>
  verify(digest, plain, OPTIONS);
