import { pasarela } from '@/lib/api/server/pasarela';

/**
 * SIN esto Next puede cachear las respuestas GET y **servir los datos de una
 * sesión a otra**. En una pasarela autenticada eso es un fallo de seguridad, no
 * una optimización perdida.
 */
export const dynamic = 'force-dynamic';

export const GET = pasarela;
export const POST = pasarela;
export const PATCH = pasarela;
export const PUT = pasarela;
export const DELETE = pasarela;
