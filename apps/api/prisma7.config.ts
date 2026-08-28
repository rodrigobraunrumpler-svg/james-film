import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Un solo .env en la raíz del monorepo. El CLI de Prisma no lo encuentra solo,
// así que se carga aquí: no hace falta envolver cada comando en dotenv-cli.
// `override: false` deja ganar a las variables ya presentes en el entorno,
// que es como .env.test apunta los tests a jamesfilm_test.
config({ path: new URL('../../.env', import.meta.url).pathname, override: false });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Migraciones e introspección van SIEMPRE por conexión directa.
    // En Neon esto es la URL sin `-pooler`; en local ambas son la misma.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
