/**
 * Railway como código. Sustituye a `railway.json` (Config as Code, deprecado: deja de leerse el
 * 1-dic-2026) y a `railway.md`, que solo existía porque JSON no admite comentarios.
 *
 * Se cambia SIEMPRE por PR (`.github/workflows/railway-config.yml`): el PR recibe el plan como
 * comentario y al mergear se aplica ESE plan. Un push directo a `main` que toque `.railway/` no
 * tiene plan: el apply falla a propósito y «Wait for CI» deja ese commit sin desplegar.
 * Lo que este fichero declara no se toca en el dashboard: el siguiente plan lo vería como deriva.
 */
import { defineRailway, github, preserve, project, service } from 'railway/iac';

/** US East (Virginia): la misma región que Neon. Cada consulta a otra cruzaría el continente. */
const REGION = 'us-east4-eqdc4a';

export default defineRailway(() => {
  const api = service('api', {
    // Sin `rootDirectory`: el contexto de build es la RAÍZ del monorepo, de donde el Dockerfile
    // copia `pnpm-lock.yaml` y `pnpm-workspace.yaml`.
    // `checkSuites` es «Wait for CI»: el job `migraciones` aplica el esquema ANTES de que arranque
    // el código que lo necesita, y un push con los tests en rojo no se despliega.
    source: github('rodrigobraunrumpler-svg/james-film', { branch: 'main', checkSuites: true }),

    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: '/apps/api/Dockerfile',
      // Exactamente lo que entra en la imagen (el `.dockerignore`). Con solo `/apps/api/**`, un
      // cambio en `packages/contracts` —los DTOs que la API `implements`— no desplegaba; sin
      // ninguno, cada push de la landing o del admin reiniciaría la API.
      watchPatterns: [
        '/apps/api/**',
        '/packages/contracts/**',
        '/docker/**',
        '/.dockerignore',
        '/package.json',
        '/pnpm-lock.yaml',
        '/pnpm-workspace.yaml',
      ],
    },

    deploy: {
      // SIN `startCommand`: pisaría el `CMD` del Dockerfile en silencio, y la imagen final no lleva
      // pnpm («pnpm: not found» en bucle). Con el `CMD` en forma exec, node es PID 1, recibe el
      // SIGTERM de cada redeploy y `enableShutdownHooks()` cierra Prisma.
      // SIN `preDeployCommand`: correría en la imagen de runtime, que no trae el CLI de Prisma. Las
      // migraciones van en el CI, contra `DIRECT_URL`: el pooler de Neon no soporta su DDL.

      // El ajuste más importante: la versión vieja sigue sirviendo hasta que la nueva conteste 200.
      // El esquema Zod no deja arrancar con una variable mal puesta, así que ese deploy se queda
      // detenido en vez de tumbar la API. `/health` hace `SELECT 1`: cubre también la base caída.
      healthcheckPath: '/health',
      // El arranque en frío de Neon tarda segundos. La primera sonda puede recibir un 503
      // (P1001/P1002/P2024), que significa «todavía no», no «roto».
      healthcheckTimeout: 120,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 3,
      // El cierre ordenado, medido sobre la imagen, tarda 1,07 s.
      drainingSeconds: 15,
      // Serverless APAGADO: el debounce de 60 s del `DeployService` vive en memoria y necesita el
      // proceso vivo. Es el mismo motivo por el que se descartó Vercel.
      sleepApplication: false,
    },

    // UNA réplica, por la aplicación y no por el contenedor: el throttler y el debounce viven en
    // memoria. Con dos, el límite de 5 logins por minuto pasa a 10 y cada cambio dispara dos
    // deploy hooks. Arreglarlo pediría Redis.
    replicas: { [REGION]: 1 },

    // Solo las variables cuyo valor difiere del default de `env.schema.ts`. `preserve()` declara
    // que existe y deja el valor en Railway: ningún secreto entra en el repo. `PORT` lo inyecta
    // Railway.
    env: {
      DATABASE_URL: preserve(), // Neon CON `-pooler`
      DIRECT_URL: preserve(), // Neon SIN `-pooler`. El esquema la exige aunque solo migre el CI
      JWT_SECRET: preserve(),
      S3_ENDPOINT: preserve(), // sin `/jamesfilm` al final: el bucket es la variable siguiente
      S3_BUCKET: 'jamesfilm',
      S3_ACCESS_KEY_ID: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      CDN_BASE_URL: preserve(), // sin barra final. Pasa a `https://media.<dominio>` en la etapa 5
      // Redundante con el `ENV` de la imagen, y por eso va fijo aquí: una variable de Railway pisa
      // ese `ENV`, y con `development` el Swagger de admin quedaría publicado en `/docs/admin`.
      NODE_ENV: 'production',
      // El default son 900 s. Con 15 min, un aftermovie de 115 MB por 4G se queda sin URL a media
      // subida y R2 contesta 403 sin mencionar la caducidad.
      PRESIGN_TTL_SECONDS: '3600',
      // Entran con la landing (etapas 4 y 5 del plan de despliegue):
      // - WEB_ORIGIN: con el default (localhost) el clic a WhatsApp no se registra, y en silencio.
      // - DEPLOY_HOOK_URL: sin él, lo que edita James no llega a la web.
    },
    // El dominio generado (`*.up.railway.app`) no se declara: IaC no gestiona esos. El propio
    // (`api.<dominio>`) entra aquí, en `domains`, en la etapa 5.
  });

  return project('james-film', { resources: [api] });
});
