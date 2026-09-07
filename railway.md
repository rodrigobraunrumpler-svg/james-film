# Por qué `railway.json` dice lo que dice

No es un fichero de ajustes por defecto: cada línea responde a algo de este
proyecto en concreto. Se documenta aparte porque JSON no admite comentarios.

## `healthcheckPath: /health`

**Es la línea más importante del fichero.** Con ella, Railway mantiene sirviendo
la versión vieja hasta que la nueva conteste 200; sin ella, promociona en cuanto
el puerto acepta conexiones y retira la vieja.

Y aquí importa más que en un proyecto cualquiera: el esquema Zod de
`env.schema.ts` hace que la app **no arranque** si falta una variable. Un
despliegue con `WEB_ORIGIN` mal escrito tiene que quedarse detenido con la
versión anterior en pie, no tumbar la API.

`/health` hace un `SELECT 1`: una sonda que no toca la base solo cubre el
arranque, y a partir del segundo uno una base caída dejaría a la app
contestando 200 sin poder servir nada.

## `healthcheckTimeout: 120`

El arranque en frío de Neon puede tardar segundos, así que la primera sonda
puede recibir un 503 — que es exactamente lo que un health check debe leer como
«todavía no» y no como «esto está roto». El filtro de excepciones ya mapea
`P1001`, `P1002` y `P2024` a 503 por esa misma razón.

## `numReplicas: 1`

**No es una limitación del contenedor: es una propiedad de la aplicación.** Con
dos réplicas se rompen dos cosas de este proyecto:

- El **throttler es en memoria y por proceso** — `ThrottlerModule.forRootAsync`
  no declara `storage`. Con dos réplicas, el límite de 5 logins por minuto pasa
  a ser 10 y el global de 120 pasa a 240. Arreglarlo pide Redis, que CLAUDE.md
  descarta.
- El **debounce de 60 s del `DeployService`** también es en memoria. Dos
  réplicas son dos temporizadores y **dos deploy hooks por cada cambio**. Y ese
  debounce es literalmente el argumento por el que se descartó Vercel: escalar
  a dos en Railway lo reintroduce por la puerta de atrás.

Con un operador y unos cuantos builds a la semana, la redundancia que hace
falta la da el health check —la versión vieja no se retira hasta que la nueva
contesta—, no una segunda copia.

## `drainingSeconds: 15`

El cierre ordenado real, medido sobre la imagen, es de **1,07 s**: `CMD` en
forma exec deja a node como PID 1, recibe el `SIGTERM` directo y
`enableShutdownHooks()` cierra las conexiones de Prisma. Quince segundos son
holgura de sobra y acortan cada despliegue.

## Lo que NO está, y por qué

- **`startCommand`**: lo tenía y se quitó. Duplicaba el `CMD` del Dockerfile, o
  sea una segunda verdad sobre cómo arranca el proceso — el día que el `CMD`
  cambie, el `startCommand` lo pisa en silencio.
- **`preDeployCommand` con las migraciones**: usa la misma imagen del servicio,
  así que habría que meter el CLI de Prisma en la de runtime (~342 MB) para
  algo que corre una vez. Las migraciones van con el objetivo `migrate` del
  propio Dockerfile, disparado desde el CI contra `DIRECT_URL` antes de
  promover. Además van por una conexión distinta a la del runtime: el pooler en
  modo transacción rompe DDL, y `prisma7.config.ts` ya las separa a propósito.
- **Plataforma o arquitectura**: en ninguna parte, ni aquí ni en el Dockerfile.
  Railway construye en su propio hierro, así que acierta por definición.
  `GET /health` devuelve `arquitectura` para confirmarlo de un vistazo.
