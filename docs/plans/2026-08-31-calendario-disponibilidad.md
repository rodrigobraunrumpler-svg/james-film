# Calendario de disponibilidad · Plan de implementación

> **Para ejecutores agénticos:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Los pasos usan checkbox.

**Goal:** Que quien entre en la web vea **qué días tiene James libres y cuáles no**, para que
deje de escribirle preguntando por fechas que ya están cogidas. Es una petición suya, literal:
«prefiero ahorrarme ese tema».

**Architecture:** Un modelo nuevo (`BusyDay`), un módulo de API con sus dos controllers, una
pantalla de admin y un componente de la landing. **Los datos viajan horneados en el build de
Astro**, no por fetch en runtime — decisión razonada abajo.

**Tech Stack:** Sin dependencias nuevas. Sin librería de calendario: la rejilla del mes son dos
bucles y `Intl`, y el proyecto ya rechazó una librería de fechas por lo mismo (§ *Fechas y zona
horaria*).

**Spec:** `CLAUDE.md` · este documento · `docs/proyecto.md` §7, §8, §9, §20

> **ESTADO (6-sep-2026).** Construido y en verde: el CORS (T1), el modelo `BusyDay`, el
> módulo de API con sus dos controllers y `fechas.ts` con sus tests (T2–T3), la landing
> (`/fechas-libres`, el calendario, los sábados rápidos) y **la pantalla del panel**
> (`/disponibilidad`), que faltaba: hasta ahora James no podía marcar ni un día y la web
> enseñaba todo libre siempre.
>
> Añadido sobre lo que este plan describía: **`GET /admin/availability/summary`**, una sola
> petición con lo que la pantalla enseña alrededor del calendario — próximas reservas
> agrupadas, sábados libres de tres meses, reservas pasadas sin galería y los clics del
> calendario separados por día libre / día ocupado.
>
> **Sigue pendiente** lo que depende de la fase 6: el aviso `EVENT_WITHOUT_GALLERY` en el
> Panel (T2.6 — aquí vive en la propia pantalla de Disponibilidad) y el despliegue
> automático, sin el cual **marcar un día no cambia la web hasta el siguiente build**.
> Las casillas de abajo son del plan original y no se han ido tocando una a una.

---

## La conversación que origina todo esto

Javier aportó una conversación real de James con una clienta. Es la investigación de usuario
más fiable que tiene el proyecto, y **casi todas las decisiones de abajo salen de ella**:

```
Clienta 10:54  Me envía los paquetes por favor
James   10:54  Hola qué tal buenos días
James   10:55  Qué fecha será señorita su boda
Clienta 10:55  24 de octubre
Clienta 10:56  Quiero para dos días
Clienta 10:56  24 y 25 de octubre
James   11:19  Los dos días será                    ← 23 MINUTOS DESPUÉS
James   11:19  La boda
James   11:19  En Ayacucho, o en algún otro lugar señorita
```

Lo que demuestra, punto por punto:

1. **La PRIMERA pregunta de James es la fecha**, no el paquete. La fecha es lo que abre el
   negocio, y es exactamente lo que el calendario resuelve.
2. **Veintitrés minutos de hueco** entre la última respuesta de ella y la siguiente de él. Ahí
   es donde se pierden clientes. Recortar los tres primeros intercambios es el valor real.
3. **Una reserva puede ser de VARIOS DÍAS** — «quiero para dos días, 24 y 25». No es un caso
   raro: es una boda normal. El modelo tiene que aguantarlo sin duplicar nada.
4. **«Me envía los paquetes por favor» se pide porque NO HAY WEB.** En cuanto la landing exista
   con los paquetes, ese mensaje deja de llegar y llegan en su lugar los que ya vienen decididos.
5. **El guion de cualificación es**: fecha → cuántos días → qué evento → dónde → paquete. Lo que
   el calendario puede adelantar sin fricción son los dos primeros; el resto es conversación,
   y es donde James gana.

---

## Por qué horneado y no fetch en runtime

La landing es Astro **estática**. Se barajaron tres formas de llevarle el calendario:

| | Coste | Frescura | Riesgo |
|---|---|---|---|
| **A · Horneado en el build** | cero en runtime | ~2 min | ninguno |
| B · Fetch desde el navegador | una petición + CORS | inmediata | 30 s de arranque en frío |
| C · Horneado + revalidación | la suma de las dos | ~2 min | la de B |

**Gana A**, y el argumento es que el dato no es «ocupado ahora mismo», es «ocupado el 12 de
octubre»: eso no cambia en segundos.

> ⚠ **CORRECCIÓN — el deploy automático NO existe todavía.** Una versión anterior de este plan
> decía «marcar un día dispara el deploy que ya existe (debounce 60 s), sale en ~2 minutos».
> **Es falso, verificado**: `TriggerDeployInterceptor` solo aparece como un comentario en
> `admin-controller.decorator.ts:36` («el de la fase 6 va AQUÍ»), y `pendingChanges` no lo
> escribe ningún servicio. **Hoy, marcar un día no cambia la web nunca.**
>
> Eso no tumba la decisión A —sigue siendo la correcta— pero sí cambia el calendario del
> proyecto: **la mitad de landing de este módulo depende de la fase 6**, no solo de la 5. La
> frescura de «~2 minutos» es lo que habrá *cuando el deploy exista*; antes de eso, la única
> forma de publicar un cambio es un build manual.

B parece mejor y es peor: en Render free la API duerme a los 15 minutos, así que el calendario
se quedaría cargando **medio minuto** justo cuando alguien lo mira. Frescura que tarda treinta
segundos en aparecer no es frescura.

**La ventana que rueda deja de ser un problema con 12 meses de datos.** Un build de hace dos
meses todavía lleva diez meses válidos, y el componente descarta lo pasado calculando «hoy» en
el navegador. Degrada suave en vez de romperse.

---

## Lo que este módulo NO es

Sin reservas. Sin confirmación. Sin estados intermedios («apalabrado»). Sin sincronizar con
Google Calendar. Sin avisarle de que se acerca un evento. Sin repeticiones.

**Un calendario que informa, no una agenda que gestiona.** Si dentro de tres meses hace falta
«apalabrado», es una columna con `default` — no un rediseño.

**Y en particular, sin recordatorio de «tienes una boda el sábado».** Solo saltaría cuando abre
el admin, que es justo cuando no le hace falta, y le diría algo que ya sabe porque lo reservó
él. Para que sirviera tendría que llegarle al móvil sin abrir nada, y eso es push: otro
subsistema. Lo que sí entra es el aviso al revés — Task 6.

---

## Global Constraints

Todo lo de `CLAUDE.md` sigue vigente. Lo específico:

- **Por defecto TODO está libre.** Se guardan los días ocupados, nunca los libres. Con la tabla
  vacía, marzo del año que viene sale entero libre y es verdad. Al revés, un mes que James no
  haya tocado saldría sin disponibilidad y dejaría el sitio peor que sin calendario.
- **Un día ocupado NO es un callejón sin salida.** Sigue abriendo WhatsApp, con «¿tienes otra
  fecha por esas semanas?». El que quería el 12 muchas veces coge el 19, y perder a ése sí es
  perder. El objetivo del negocio sigue siendo una sola cosa: clics a WhatsApp.
- **En la web, un día ocupado dice «ocupado» y nada más.** Ni el tipo de evento ni el lugar: es
  información de un cliente que no ha dado permiso para publicarla (Ley 29733, §19). La nota es
  **privada** y no sale del admin — hay test de que el DTO público no la lleva.
- **Un día es libre u ocupado, entero.** Sin mañana/tarde y sin cupos.
- **`@db.Date` y `timeZone: 'UTC'` al formatear.** Es una fecha de calendario, no un instante:
  formatearla en Lima resta 5 horas y muestra el día anterior. Ya pasó con `eventDate`.
- **«Hoy» se calcula en `America/Lima`, explícito**, tanto en la API como en el navegador. Un
  visitante desde otro huso no puede ver un «hoy» distinto al de James, y el contenedor de
  producción corre en UTC.
- **Nada que se marque puede costar más de un toque.** Un calendario desactualizado es peor que
  no tener calendario: hoy, si James no contesta, no pasa nada; con calendario, un día que pone
  «libre» y no lo está es una promesa rota que se lleva justo la conversación que quería evitar.
  Si mantenerlo cuesta trabajo, no lo mantendrá.
- **Toda mutación es un «cambio sin publicar».** Los endpoints se escriben sabiendo que llevarán
  el `TriggerDeployInterceptor`.
- **`@AdminController`** en el controller de admin, y el público con `@SkipThrottle()`: el build
  de Astro hace decenas de peticiones desde una IP en segundos.

---

## Task 1 · CORS y la supervivencia del clic ✅

**Se hace PRIMERO y no es del calendario**, pero el calendario lo hereda y hoy está roto.

`POST /track/whatsapp` está pensado para que lo llame el navegador de quien visita la landing.
Con `Content-Type: application/json` desde otro origen eso dispara un **preflight `OPTIONS`**, y
la API **no tiene `enableCors` en ninguna parte** (verificado en `bootstrap.ts` y en
`env.schema.ts`). O sea que **el clic a WhatsApp —la única métrica del negocio— no se
registraría**, y el modo de fallo es el peor: silencioso. El panel diría «0 clics» y parecería
que la web no funciona.

Y hay un segundo problema que el primero tapaba: **el clic que hay que registrar es justo el que
abandona la página.** Al pulsar el botón el navegador salta a `wa.me`, y un `fetch()` normal
puede morir en esa navegación. Se arreglan juntos o no se arregla ninguno.

- [x] **T1.1** `WEB_ORIGIN` en `env.schema.ts`: lista separada por comas, validada como URLs.
      En local, `http://localhost:4321`.
- [x] **T1.2** En `bootstrap.ts` —no en `main.ts`, para que los tests de integración prueben el
      arranque real:

```ts
// El navegador de la LANDING habla directamente con la API: el clic a WhatsApp
// se registra desde ahí. `CLAUDE.md` ya lo anticipaba — «vuelve a hacer falta el
// día que un navegador hable directamente con la API».
app.enableCors({
  // Lista blanca, nunca '*'. No para el atacante decidido —CORS no detiene a
  // curl— sino para que nadie infle los clics embebiendo el botón en otra web.
  origin: env.WEB_ORIGIN,
  methods: ['GET', 'POST'],
  // LO QUE CONSERVA «sin superficie de CSRF»: sin credenciales no hay cookie
  // que el navegador mande sola. El admin sigue yendo por la pasarela.
  credentials: false,
  maxAge: 86_400, // el preflight se cachea un día
});
```

- [x] **T1.3** El `OPTIONS` del preflight **no puede gastar cuota del throttler global**: si el
      preflight consume, el `POST` de detrás se queda sin. `enableCors` responde antes que los
      guards, pero **se verifica con un test**, no se supone.
- [x] **T1.4** Documentar en `CLAUDE.md` que el CORS vuelve, **con credenciales en `false`**, y
      que eso es lo que mantiene la propiedad que la nota original protegía.

**Tests de integración** — `test/cors.integration.spec.ts`, los cinco en verde y
**comprobado que 3 de ellos fallan si se quita el `enableCors`**.
- [x] Un `OPTIONS` desde un origen de la lista responde 204 con `Access-Control-Allow-Origin`.
- [x] Desde un origen que no está en la lista, la cabecera **no** viene.
- [x] `Access-Control-Allow-Credentials` **no** aparece nunca.
- [x] 60 preflights seguidos no agotan el límite del `POST` que va detrás.

**Lo que salió construyéndolo.**
· **`WEB_ORIGIN` se normaliza a `origin`**: `enableCors` compara la cadena tal cual, así que
  una barra final dejaba el CORS roto sin decir por qué.
· **Dos tests montaban un `ConfigModule` mínimo sin `validateEnv`** y `getOrThrow('WEB_ORIGIN')`
  los tumbaba. Se les da la variable a mano en vez de ablandar `configurarApp`: que reviente
  cuando falta es lo correcto — en la app de verdad, no tenerla deja el clic sin registrar.

**Y en la landing (Task 7):** el `fetch` de tracking va con **`keepalive: true`**, que es lo que
lo hace sobrevivir a la navegación. Sin eso el clic se pierde justo cuando funciona.

---

## Task 2 · Schema, migración y contratos

- [ ] **T2.1** `BusyDay` en `schema.prisma`:

```prisma
/// Un día que James NO tiene libre. Lo que no está aquí, está libre: se guarda
/// la excepción, no la norma. Con la tabla vacía el año entero sale libre, que
/// es lo correcto y lo que no exige mantenimiento.
model BusyDay {
  id   String   @id @default(cuid())
  /// Fecha de calendario, no instante. `@unique` hace el marcado idempotente:
  /// marcar dos veces el mismo día no puede crear dos filas, y es además el
  /// índice por el que se consulta siempre (rango entre dos fechas).
  date DateTime @unique @db.Date
  /// PRIVADA. Solo la ve James en el panel; el DTO público no la expone.
  /// Se repite en todos los días del mismo `groupId` — el servicio los escribe
  /// juntos y los edita juntos, nunca fila a fila.
  note String?
  /// Los días marcados A LA VEZ comparten grupo: «24 y 25 de octubre» es UNA
  /// boda, no dos. Cuando James los marca, el sistema YA sabe que van juntos;
  /// tirar ese dato y reconstruirlo luego adivinando («días seguidos con la
  /// misma nota serán lo mismo») fallaría justo en el caso real de un sábado de
  /// boda seguido de un domingo de cumpleaños.
  /// Sin él, el aviso del Panel saltaría dos veces por la misma boda, «Lo que
  /// viene» pintaría dos líneas y se ofrecerían dos galerías.
  /// Nullable: los días sueltos no necesitan grupo.
  groupId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([groupId])
}
```

- [ ] **T2.2** **Sin `@@index([date])`**: `@unique` ya crea el índice. Declarar los dos deja un
      índice duplicado que Postgres mantiene en cada escritura para nada.
- [ ] **T2.3** **Sin soft delete, y a propósito.** La regla de `deletedAt` existe porque
      `Media.galleryId` tiene `onDelete: Cascade` y borrar en duro dejaba objetos huérfanos en R2
      para siempre. Aquí no cuelga nada de una fila: desmarcar un día es un `DELETE` de verdad, y
      guardar el historial de días que estuvieron marcados no le sirve a nadie.
- [ ] **T2.4** Migración `añadir_busy_day` (snake_case en español, como
      `quitar_gallery_coverkey`). Drift comprobado en CI.
- [ ] **T2.5** Contratos en `packages/contracts` (solo tipos, cero runtime). `IsoDate` y
      `IsoDateTime` ya existen — se reusan, no se redeclaran:

```ts
/** Un día ocupado tal y como lo ve el ADMIN. `note` nunca sale al público. */
export interface BusyDayDto {
  date: IsoDate;
  note: string | null;
  /** Los días de una misma reserva lo comparten. `null` si es un día suelto. */
  groupId: string | null;
}

/**
 * Una reserva, ya agrupada: lo que el Panel pinta y lo que el aviso cuenta.
 * «24 y 25 de octubre» es UNA de éstas, no dos días.
 */
export interface BookingDto {
  /** El `groupId`, o la propia fecha cuando es un día suelto. */
  id: string;
  from: IsoDate;
  to: IsoDate;
  note: string | null;
}

/**
 * Lo que consume la landing. Solo fechas: sin notas, sin ids, sin nada que
 * identifique a un cliente.
 */
export interface AvailabilityDto {
  /** Días ocupados, en orden. Lo que NO está aquí y cae dentro de la ventana, libre. */
  busy: IsoDate[];
  /**
   * Hasta dónde llega el dato. **Es imprescindible**: sin él, la landing no
   * puede distinguir «libre» de «no lo sé», y un día a catorce meses vista
   * saldría libre cuando en realidad no hay información. Un día más allá de
   * `until` NO se pinta — ni libre ni ocupado.
   */
  until: IsoDate;
  /**
   * La última vez que James tocó el calendario, para el «actualizado hace X».
   * `null` si nunca ha marcado nada.
   */
  updatedAt: IsoDateTime | null;
}

/**
 * Marca o desmarca. Un solo endpoint para el toque, el arrastre y el rango.
 * Marcar varias fechas de una vez las mete en el MISMO grupo: es lo que
 * convierte «24 y 25» en una reserva en vez de en dos días sueltos.
 */
export interface SetAvailabilityInput {
  dates: IsoDate[];
  busy: boolean;
  /** Solo se aplica cuando `busy` es true. Se escribe en todos los días. */
  note?: string | null;
}
```

- [ ] **T2.6** Ampliar `AttentionKind` con `'EVENT_WITHOUT_GALLERY'` y `DashboardDto` con
      **`proximos: BookingDto[]`** — reservas, no días sueltos: con `BusyDayDto[]`, una boda de
      dos días ocuparía dos de las tres líneas del bloque.
- [ ] **T2.7** Seed: **no siembra días ocupados**. Un calendario de ejemplo en producción sería
      mentira publicada. Bajo la bandera de demo sí, para tener algo que mirar en local.

---

## Task 3 · Módulo `availability` en la API

- [ ] **T3.1** **Un helper de fecha, en un solo sitio.** Es donde se cuelan los fallos de zona
      horaria, así que no se escribe dos veces:

```ts
/**
 * `YYYY-MM-DD` de HOY en Lima. `en-CA` da el formato ISO ya ordenado, que es
 * el truco para no montar la cadena a mano. El contenedor corre en UTC: sin el
 * `timeZone` explícito, a partir de las 19:00 de Lima el servidor ya está en el
 * día siguiente y `until` se desplaza un día.
 */
const hoyEnLima = (): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

/**
 * Prisma devuelve un `Date` a medianoche UTC para una columna `@db.Date`.
 * `slice(0,10)` sobre el ISO es lo único correcto: cualquier formateo local
 * resta cinco horas y devuelve el día anterior.
 */
const aIsoDate = (d: Date): IsoDate => d.toISOString().slice(0, 10);
```

- [ ] **T3.2** `availability.service.ts`, `PrismaService` directo, sin repository:
  - `listar(from, to): Promise<BusyDayDto[]>` — **anotado con el DTO**, que es lo que hace que un
    `select` incompleto falle cerrado. `orderBy: { date: 'asc' }`; **no hace falta desempate por
    `id`** porque `date` es único — la regla del `{ id: 'asc' }` aplica a los `order @default(0)`,
    que sí empatan.
  - `publica(): Promise<AvailabilityDto>` — ventana de **12 meses móviles** desde `hoyEnLima()`.
    `until` se **calcula, no se guarda**. `updatedAt` sale de un `_max` sobre la tabla.
  - `agrupar(dias): BookingDto[]` — colapsa por `groupId`; los días sueltos (`groupId: null`)
    quedan cada uno como su propia reserva. Lo usan el Panel y el aviso, **no** el endpoint
    público: a la landing le da igual si dos días son una boda o dos.
  - `marcar(input): Promise<BusyDayDto[]>` — un `$transaction`:
    `busy: true` → un `groupId` NUEVO para toda la tanda (`cuid()`), luego
    `createMany({ data, skipDuplicates: true })` y `updateMany` de la nota y el grupo. **Marcar
    varias fechas de una vez las mete en el mismo grupo**: es lo que convierte «24 y 25» en una
    reserva. Marcar un día suelto también crea grupo — así ampliar una reserva después es
    reasignar, no un caso especial.
    `busy: false` → `deleteMany({ where: { date: { in } } })`. **Desmarcar un día del medio parte
    la reserva y no pasa nada**: los que quedan siguen compartiendo grupo y se pintan como dos
    bloques. No hay que reparar nada, y por eso el grupo es una etiqueta y no un rango.
    **Idempotente en los dos sentidos**: marcar lo ya marcado no duplica ni lanza P2002, y
    desmarcar lo que no existe no revienta.
- [ ] **T3.3** `availability.controller.ts` (público): `GET /availability`, `@Public()`,
      `@SkipThrottle()`. **No acepta NINGÚN parámetro** — ni para ampliar la ventana ni para pedir
      notas. Un endpoint público sin parámetros no puede filtrarse mal.
- [ ] **T3.4** `availability.admin.controller.ts` con `@AdminController('availability')`:
      `GET /admin/availability?from=&to=` y `PUT /admin/availability`.
- [ ] **T3.4b** **Ampliar `FUENTES` ANTES de escribir una línea de landing.** Hoy es
      `['hero','paquetes','footer','galeria']` (`tracking/dto/track-click.dto.ts:6`) con un
      `@IsIn`, así que **`source: 'calendario'` daría 422 y el clic se perdería en silencio** —
      el `fetch` va con `keepalive` y nadie lee la respuesta. El panel enseñaría cero clics del
      calendario y la conclusión sería «el calendario no funciona».
      Peor: los clics de paquete **sin** fecha seguirían contando bien, así que la atribución
      saldría parcial y coherente. Eso no se diagnostica mirando el panel.
      Pasa a `[..., 'calendario-libre', 'calendario-ocupado']`. **Distinguir los dos es el punto**
      — es lo que dice si el «ocupado» rescata o expulsa.
- [ ] **T3.4c** Los DOS comentarios que enumeran las fuentes están desfasados y **ya omiten
      `'galeria'`**, que existe desde hace tiempo: `prisma/schema.prisma:246` y
      `packages/contracts/src/index.ts:523`. Es la prueba de que la lista escrita a mano se
      queda atrás siempre. Se sustituyen por «ver `FUENTES` en `track-click.dto.ts`».
- [ ] **T3.4d** `apps/api/src/modules/tracking/docs/tracking.docs.ts` dice que la landing lo manda
      con `sendBeacon`. **No es intercambiable con `keepalive`**: `sendBeacon` no puede fijar
      `Content-Type: application/json` —manda `text/plain` o un Blob— así que ni dispararía el
      preflight que arregla el Task 1 ni lo aceptaría el `ValidationPipe`. Corregirlo.
- [ ] **T3.5** **`AvailabilityModule` en el `include` del OpenAPI público.** Sin eso la fase 5 no
      sabe que el endpoint existe — es exactamente lo que pasó con `TrackingModule`.
- [ ] **T3.6** Regenerar `docs/openapi-public.json` (el CI lo congela y falla si cambia solo).
- [ ] **T3.7** Validación del `PUT`:
  - `dates`: `@IsArray()`, `@ArrayMaxSize(366)`, cada una `@Matches(/^\d{4}-\d{2}-\d{2}$/)`.
    **El techo no es cosmético**: sin él, un `PUT` con cien mil fechas es una denegación de
    servicio gratis, igual que el máximo de longitud del `LoginDto`.
  - `note`: `@MaxLength(200)`. Es una nota, no una descripción.
  - **Solo se rechaza MARCAR en pasado, nunca DESMARCAR.** La regla ingenua («fechas pasadas →
    422») tiene dos trampas que la hacen inservible:
    1. **Un día mal marcado en el pasado no se podría quitar jamás** — y equivocarse al arrastrar
       un rango es justo lo que va a pasar.
    2. **«Pasado» comparado contra UTC rechaza HOY durante todo el día en Lima**: a las 10 de la
       mañana en Ayacucho ya es el mismo día en UTC, pero a las 20:00 el servidor está en el día
       siguiente y el 24 de octubre —hoy— pasaría a ser pasado. Se compara contra
       **`hoyEnLima()`**, no contra `new Date()`.
    Regla final: `busy: true` con fecha < `hoyEnLima()` → 422. `busy: false` → siempre válido.

**Tests de integración**
- [ ] El DTO público **nunca** lleva `note` ni `id`. Test explícito, no inspección a ojo.
- [ ] Un día fuera de la ventana de 12 meses no aparece, y `until` lo dice.
- [ ] `PUT` dos veces con las mismas fechas deja **una** fila por día.
- [ ] `PUT` con `busy: false` sobre días que no existían responde 200, no 404.
- [ ] Marcar una fecha pasada da **422**, no 500.
- [ ] **Desmarcar** una fecha pasada da **200**: un día mal puesto se tiene que poder quitar.
- [ ] Con el reloj a las 20:00 de Lima, marcar HOY se acepta. Es el test que caza la comparación
      contra UTC.
- [ ] Marcar `['2026-10-24','2026-10-25']` deja los dos días con **el mismo** `groupId`.
- [ ] Marcarlos en DOS llamadas separadas deja **grupos distintos** — son dos decisiones, y el
      sistema no debe adivinar que iban juntas.
- [ ] Desmarcar el día del medio de un grupo de tres no deja nada roto.
- [ ] 367 fechas dan 422 con `VALIDATION_FAILED` y su `details`.
- [ ] **`it.each(FUENTES)`** sobre la constante importada, esperando 204. **Por iteración, no por
      enumeración**: así el valor que se añada mañana trae su prueba sin que nadie se acuerde. Se
      conserva el de `'inventado'` → 422, que protege la lista cerrada.
- [ ] Con el proceso en `TZ=UTC` y la hora simulada a las 20:00 de Lima, `until` sigue siendo el
      día correcto. **Es el test que justifica todo el T3.1.**

---

## Task 4 · Hora de Perú en todo · **arregla un fallo que ya existe**

`dashboard.service.ts:22-28` agrupa los días de la serie de clics con `toISOString()`, es decir
**en UTC**. Perú es UTC−5, así que **todo clic a partir de las 19:00 de Lima cuenta como el día
siguiente**. Un tercio del día se atribuye mal, y en un negocio donde se escribe por la tarde eso
no es un detalle.

El comentario que lo justifica mezcla dos cosas distintas: «no uses la zona del proceso»
(correcto — la máquina de desarrollo está en Lima y el contenedor en UTC) con «usa UTC»
(incorrecto para este dato). La regla buena es **zona explícita**, y para lo que lee James esa
zona es Lima.

**La distinción, que hay que dejar escrita porque se vuelve a colar:**

| Qué | Cómo se formatea | Por qué |
|---|---|---|
| Fecha de calendario (`eventDate`, `BusyDay.date`, `@db.Date`) | **UTC** | Se guarda a medianoche UTC; en Lima restaría 5 h y saldría el día anterior |
| Instante (`createdAt` de un clic, `updatedAt`) | **`America/Lima`** | Es un momento que James vivió, a su hora |

- [ ] **T4.1** `claveDia()` en `dashboard.service.ts` pasa a
      `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(fecha)`. `en-CA` da
      el `YYYY-MM-DD` ya ordenado sin montar la cadena a mano.
- [ ] **T4.2** Reescribir el comentario: la razón no es «UTC», es «zona explícita», y aquí la
      explícita es Lima.
- [ ] **T4.3** **La ventana móvil no cambia**: sigue siendo `ahora - 30 días`, no meses de
      calendario. Eso ya era correcto y no depende de la zona.
- [ ] **T4.4** Barrer el resto del repo buscando la misma confusión: cualquier `toISOString()`
      que agrupe o compare un **instante** por día.

**Tests**
- [ ] Un clic a las **20:00 hora de Lima** cae en la barra de **ese** día, no en la del siguiente.
      Es el test que define el arreglo, y hay que comprobar que **falla con el código de antes**.
- [ ] Con `TZ=UTC` en el proceso y con `TZ=America/Lima`, la serie sale **idéntica**.
- [ ] Los tests existentes del dashboard que asumían UTC se actualizan, y se anota cuál cambió y
      por qué — no se «arreglan» en silencio.

---

## Task 5 · Pantalla del admin · `/calendario`

Es la **novena** pantalla y el **séptimo** elemento del menú (hoy son seis). `CLAUDE.md` dice
ocho: hay que actualizarlo.

- [ ] **T5.1** `src/features/calendario/` con `services/`, `hooks/`, `components/`. Ninguna
      feature importa de otra; lo que se comparta sube a `lib`.
- [ ] **T5.2** **NO se escribe una rejilla a mano: `react-day-picker` 10.0.1 YA está instalado**
      y en uso en `components/shared/campo-fecha.tsx`. Una versión anterior de este plan decía
      «la rejilla del mes, a mano» — sería un segundo calendario al lado del que ya existe, con
      su propio bug de primer-día-de-la-semana y su propio estilo.
      Se usa el que hay, en modo múltiple/rango, con `locale` es-PE y los `modifiers` para
      ocupado/libre. **Lo que sí se escribe a mano es lo que la librería no hace**: el mapeo
      `Date` ↔ `IsoDate` y la agrupación por reserva.
- [ ] **T5.3** Abre en el **mes actual**, flechas adelante y atrás. Nunca doce meses de golpe: se
      navega. **Atrás se deshabilita en el mes actual** y adelante en el mes de `until`.
- [ ] **T5.4** **Un toque marca o desmarca.** Mantener y arrastrar marca un rango — hace falta
      para una semana de viaje, y sin ello marcará siete días a mano o no los marcará.
- [ ] **T5.5** **Camino táctil obligatorio.** Arrastrar sobre una rejilla pelea con el scroll de
      la página, y `touch-action: none` mataría el scroll de la pantalla entera. En táctil:
      tocar el primer día, pulsar «hasta…», tocar el último. Es el mismo patrón que las flechas
      de reordenar frente al arrastre en el editor.
- [ ] **T5.6** **Cada día es un `<button>` de verdad**, con `aria-pressed={ocupado}` y
      `aria-label` con la fecha completa («sábado 12 de septiembre, ocupado»). Sin `role="grid"`
      inventado: un rol que se declara y no se implementa entero es peor que ninguno.
- [ ] **T5.7** **Tabulador rodante (`roving tabindex`).** Solo la celda enfocada lleva
      `tabIndex={0}` y las flechas mueven el foco; el resto va a `-1`. No es un adorno: sin esto,
      un mes son **42 paradas de tabulador** antes de llegar a cualquier cosa de debajo.
- [ ] **T5.8** Nota privada en una `Hoja`, nunca en un `confirm()` — hay cero en el admin y se
      queda en cero.
- [ ] **T5.9** **Optimista con reversión.** Marcar un día tiene que verse al instante; si el
      `PUT` falla, el día vuelve a su sitio y sale un toast. Es la regla del proyecto y aquí es
      obvia: el servidor no decide nada impredecible.
- [ ] **T5.10** 🔶 **Ancho a 320 px — se decide MIDIENDO.** Siete columnas en 288 px útiles dan
      **41 px** por celda, por debajo de los 44 de §7. La propuesta: celdas de **44 px de alto** y
      ancho `minmax(0,1fr)`. El test mide el alto, y 41×44 sigue siendo cómodo en una rejilla
      donde todos los vecinos son del mismo tipo. **Se decide con el test delante**, y lo que
      salga se escribe en `CLAUDE.md` con su medida — como se hizo con el umbral táctil.
- [ ] **T5.11** Menú: icono `CalendarDays` del mapa estático de `lucide-react` (resolución
      dinámica no, que cae al de reserva en silencio). **Sin recuento**: un número ahí no lleva a
      ninguna acción.
- [ ] **T5.12** ⌘K: la ruta con sus sinónimos en `busca` — «calendario», «disponibilidad»,
      «agenda», «fechas», «libre», «ocupado». Sin eso el atajo solo sirve si ya sabes cómo se
      llama la pantalla, que es justo lo que no sabes cuando te pierdes.
- [ ] **T5.13** **Al marcar un día, ofrecer crear su galería en borrador** con la fecha puesta.
      **Una galería por RESERVA, no por día**: «24 y 25» son una boda y una galería, con
      `eventDate` en el primer día. Es el momento bueno: está marcando esos días porque acaba de
      cerrar esa boda, con el nombre del cliente en la cabeza. Cuando vuelva del evento ya tiene dónde soltar los reels, y
      el aviso del Task 6 pasa de ser lo normal a ser la excepción.
      **Dos condiciones para que no estorbe:** es una línea que se ofrece donde acaba de marcar,
      no un formulario que se le echa encima; y **no bloquea** — si la ignora, el día queda
      marcado igual. Reusa el `POST /admin/galleries` que ya existe.

**Tests**
- [ ] Marcar → optimista → el `PUT` sale con las fechas correctas.
- [ ] Si la API falla, el día vuelve y sale el toast.
- [ ] El camino táctil marca **el mismo rango** que el arrastre. **En Playwright, no en Testing
      Library**: en happy-dom `getBoundingClientRect()` devuelve ceros y un test de arrastre no
      falla — no hace nada y pasa.
- [ ] Las flechas mueven el foco y el tabulador entra y sale del mes en **una** parada.
- [ ] Ofrecer la galería no bloquea: ignorarla deja el día marcado.
- [ ] Entra en `e2e/responsive-total.spec.ts`: nueve anchos × **dos temas**, y en el test de
      contraste, que compone el fondo real capa a capa.

---

## Task 6 · Panel

- [ ] **T6.1** **Bloque «Lo que viene»**: las tres próximas **reservas** —no días sueltos— con su
      nota privada y enlace al calendario. Una boda de dos días es **una** línea, «24–25 oct»:
      con días sueltos ocuparía dos de las tres. Es su agenda de un vistazo y lo único del calendario que mira al
      entrar.
  - **Sexta consulta dentro del `Promise.all` de `GET /admin/dashboard`**, no un endpoint aparte:
    la pantalla no puede pintarse a trozos, y cinco peticiones darían cinco saltos de layout en
    el 4G de James.
  - Sin días por delante, **el bloque no se pinta**. Un hueco vacío se lee como fallo de carga.
  - **«Próximas» se calcula contra `hoyEnLima()`, no contra `new Date()`.** Con UTC, a partir de
    las 19:00 de la víspera el evento de mañana ya cuenta como pasado y **desaparece del bloque
    justo la tarde antes** — que es cuando más se mira. Lo mismo en la ventana de 30 días del
    aviso: en UTC empieza y acaba cinco horas antes de lo que James entiende por «hace un mes».
- [ ] **T6.1b** **`bySource` en `ClickStatsDto`.** `WhatsappClick.source` se escribe desde la
      fase 2 y **no lo lee absolutamente nadie**: `ClickStatsDto` tiene `byPackage` y `noPackage`
      y nada por fuente. Este plan añade un bloque que **puede reducir los clics** —un «ocupado»
      es un rechazo que se auto-sirve— y sin desglose por fuente no hay forma de saber si el
      calendario suma o resta. Es el número que decide si el módulo se queda o se quita.
      Se pinta discreto, bajo el reparto por paquete. Con `calendario-libre` y
      `calendario-ocupado` separados, la pregunta se contesta sola.
- [ ] **T6.2** **Aviso `EVENT_WITHOUT_GALLERY`**:

  > ⚠ **El sábado 12 tuviste un evento y su galería sigue vacía.** → *Subir reels*

  - Una **reserva** (agrupada, no un día suelto) de los **últimos 30 días** sin ninguna `Gallery`
    cuyo `eventDate` caiga dentro de ella. La ventana hacia atrás es lo que impide que un evento
    de hace un año siga avisando para siempre.
  - **Agrupado importa aquí más que en ningún sitio**: sin `groupId`, la boda del 24 y 25 daría
    DOS avisos idénticos, y dos avisos iguales entrenan a descartarlos sin leer.
  - **La galería se busca con `deletedAt: null`.** Sin eso, una galería borrada dejaría el aviso
    apagado para siempre justo cuando más falta hace.
  - **Se agrupan si son varios**, igual que los medios fallidos por galería: cuatro avisos
    idénticos entrenan a descartarlos sin leer.
  - Gravedad **media** (latón), no roja. Rojo es solo para lo que ya salió mal en la web.
  - `id` **estable entre cargas** — es lo que el admin guarda en `localStorage` al descartarlo.
    Derivarlo del `groupId` (o de la fecha si es suelto), nunca de un índice de la lista.
  - **`FILO` en `bloque-atencion.tsx` es un `Record` total sobre la unión**, así que añadir el
    `kind` nuevo **no compila** hasta darle su filo. Falla cerrado: no hay forma de olvidarlo.
    `grave` se queda en `false` — sigue decidiendo la variante del botón.

- [ ] **T6.3** ⚠ **El borrador que crea T5.13 envenena el aviso `STALE_DRAFT` que ya funciona.**
      Ese aviso salta cuando una galería lleva **3 días en borrador**, y la que se crea al marcar
      un día nace en borrador **meses antes** del evento: para cuando llegue la boda, James lleva
      un trimestre viendo un aviso que no puede resolver. Y un aviso que no se puede resolver
      entrena a descartarlos todos, que es justo lo que el Panel existe para evitar.
      **`STALE_DRAFT` tiene que ignorar las galerías cuyo `eventDate` esté en el FUTURO.** Un
      borrador de un evento que no ha ocurrido no está estancado: está esperando.
      Con test de que una galería con `eventDate` a dos meses vista no avisa.

**Tests**
- [ ] Un `BusyDay` pasado **con** galería no avisa.
- [ ] Tres días pasados **del mismo grupo** dan **un** aviso, no tres.
- [ ] Tres días pasados de **grupos distintos** dan tres — agrupar de más esconde trabajo.
- [ ] Un `BusyDay` de hace 60 días no avisa.
- [ ] Una galería con `deletedAt` **no** cuenta como galería.

---

## Task 7 · Landing · **dentro de la fase 5**

`apps/web` tiene hoy **dos archivos**: la landing no existe. Construir esto antes es construir al
revés — dónde va el calendario, si le pelea la atención al bloque de paquetes y cómo se lee en un
móvil solo se contesta contra una landing real.

### El flujo, y por qué NO es un selector de paquete

La propuesta inicial era: pulsar una fecha → elegir un paquete → ir a WhatsApp. **La dirección es
buena y el orden es malo.** Eso mete un paso ENTRE «está interesado» y «pulsa WhatsApp», que es
la única conversión que existe en este sitio: no hay formulario, el clic **es** el lead. Y
peor — si la clienta se auto-asigna el Básico en la web, se cierra sola la puerta al upsell que
James haría hablando, que es donde gana.

**La misma idea sin el paso de más: la fecha elegida ENRIQUECE todos los CTA que ya hay.**

| Lo que pulsa | Mensaje que sale |
|---|---|
| El día libre, directamente | «Hola James, ¿tienes libre el **sábado 24 de octubre**?» |
| Dos días | «…**del 24 al 25 de octubre**?» — como lo pidió ella, literal |
| Un paquete, con fecha ya elegida | «…el **24 de octubre**, me interesa el **PRO**» |
| Un paquete, sin fecha | «…me interesa el **PRO**» *(el comportamiento de siempre)* |
| Un día **ocupado** | «…¿tienes otra fecha por esas semanas?» |

Sin formulario, sin puerta y sin paso extra: quien va directo va directo, y quien mira paquetes
sale con **los dos datos que James pregunta primero**. `WhatsappClick` ya tiene `packageId` y
`source`, así que a los dos meses se sabe qué camino convierte.

**Lo que NO va en el mensaje pre-escrito:** el lugar, el número de invitados, la hora, «cuántos
días». Un muro de texto pre-escrito se borra antes de enviarlo. Va lo que él pregunta primero y
ella no se molestaría en teclear. El *«En Ayacucho, o en algún otro lugar»* lo sigue preguntando
él — esa respuesta cambia el precio.

### Implementación

- [ ] **T7.1** El build pide `GET /availability` y lo hornea. **Si responde no-2xx, el build
      aborta**: un deploy fallido es mejor que uno con el calendario vacío diciendo que todo está
      libre. Es la regla que ya rige el resto del build de Astro.
- [ ] **T7.1b** **`vanilla-calendar-pro` 3.3.1 en la landing, NO `react-day-picker`.**
      `apps/web` no tiene React (verificado en `astro.config.mjs`): traerlo son `@astrojs/react` +
      `react` + `react-dom` + rdp ≈ **60 KB de JS** en una página estática con presupuesto de INP
      medido en CrUX y clientes en 4G. `vanilla-calendar-pro` no tiene peer-dependencies, lleva
      rangos, temas y locale, y se publicó en agosto de 2026.
      **Dos librerías de calendario en el repo es correcto aquí**: son dos apps con dos runtimes
      y dos públicos. Unificarlas obligaría a meter React en la landing.
      Su API se verifica con `context7` **antes** de escribir la primera línea, como manda
      `CLAUDE.md`.
- [ ] **T7.2** Componente `client:visible`, **nunca `client:load`**. Solo `transform` y `opacity`,
      dentro de `prefers-reduced-motion`. **Se mide el INP antes y después**, como manda la fase 5.
- [ ] **T7.3** «Hoy» en el navegador, en `America/Lima`, explícito. Lo pasado no se pinta. Lo que
      cae más allá de `until` **no se pinta como libre**: no se pinta.
- [ ] **T7.4** **La fecha elegida se comparte entre islas SIN dependencia.** Astro no comparte
      estado de React entre islas, y `nanostores` sería una dependencia nueva para esto.
      Se hace con un `CustomEvent` en `document` y un listener delegado que reescribe el `href`
      de todo `[data-wa]`. Quince líneas, cero paquetes.
- [ ] **T7.5** **El mensaje se construye en UN solo sitio** (`lib/whatsapp.ts` en `apps/web`),
      que consumen el hero, los paquetes, el pie y el calendario. Con cuatro sitios construyendo
      la cadena, en dos semanas dicen cosas distintas.
      **Un solo sitio es el CÓDIGO; la fuente del TEXTO es la base.** `whatsappMessage` ya existe
      en `SiteSettings` y en `Package`, y James lo edita desde Configuración. El constructor
      recibe el base ya resuelto (`paquete.whatsappMessage ?? settings.whatsappMessage`) y lo
      único que compone es **la frase de contexto** —la fecha, el rango, o el «¿tienes otra fecha
      por esas semanas?»—. Nunca reescribe ni reordena el base; si viene vacío, la frase de
      contexto es el mensaje entero.
      **Y no es opcional, porque el admin ya PROMETE esa igualdad:** `campo-whatsapp.tsx` mete
      `whatsappMessage` en el enlace de «Probar este número» para que James vea lo que va a pasar
      al pulsar el botón de la web. Si la landing compone su propio texto, ese botón de prueba
      pasa a mentir — y miente en silencio.
      **Los literales de la tabla de arriba son ILUSTRATIVOS**, no el texto final.
- [ ] **T7.6** La fecha se escribe con
      `Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })`
      — **UTC porque es una fecha de calendario**, no un instante (ver la tabla del Task 4).
- [ ] **T7.7** **Segundo toque = rango.** Tocar otro día convierte la selección en «del 24 al 25».
      Un tercer toque vuelve a empezar. Sin librería y sin arrastre: en un móvil, arrastrar sobre
      la rejilla pelea con el scroll.
- [ ] **T7.8** La selección **se ve**: el día elegido queda marcado y hay una forma obvia de
      quitarlo. Una fecha pegada a los botones sin poder cambiarla es una trampa.
- [ ] **T7.8b** **Sus pistas, que sin ellas la rejilla es decoración.** «Toca el día de tu
      evento» sobre el calendario; «Ese día ya está tomado. Toca para preguntar por otra fecha»
      en un ocupado. La regla de la fase 5: **una pista dice lo que VA A PASAR**, no lo que la
      cosa es. Y **nada solo en `:hover`** — quien entra aquí está en un móvil.
- [ ] **T7.9** **Escasez honesta**: «Quedan 3 sábados libres en octubre».
      **Solo se pinta si hay escasez de verdad** — es decir, si ese mes tiene algún sábado ya
      ocupado. Con el mes entero libre, «quedan 4 sábados libres» no da urgencia: da la contraria.
- [ ] **T7.10** **«Actualizado hace 2 días»**, de `updatedAt`, con `Intl.RelativeTimeFormat`. Es
      el antídoto real contra la promesa rota: si lleva un mes sin tocarlo, el visitante lo ve y
      no se lo achaca a nadie.
      ⚠ **`max(updatedAt)` RETROCEDE al desmarcar.** Desmarcar borra filas, así que si la más
      reciente era la que se quitó, el máximo baja y la web diría «actualizado hace un mes» justo
      después de que James lo tocara. Y esa frase es una promesa: si retrocede, miente en la
      dirección peor.
      **Se guarda el instante en `SiteSettings` (`availabilityUpdatedAt`) y lo escribe el servicio
      en cada `marcar()`, ponga o quite.** Es un `updatedAt` de la *acción*, no de las filas.
- [ ] **T7.11** Tracking con `source: 'calendario'` (o `'paquete'` si salió de ahí con fecha) y
      **`fetch(..., { keepalive: true })`** — el clic navega a `wa.me` y sin `keepalive` la
      petición muere en la navegación. Depende del Task 1.
- [ ] **T7.12** 320 px sin scroll horizontal, `minmax(0,1fr)` en la rejilla, zoom al 200 %,
      `overflow-wrap: anywhere` donde haya texto que no controlamos.
- [ ] **T7.12b** **El estado del primer día.** Sin nada marcado, `updatedAt` es `null` y el
      calendario sale entero libre. Ahí **no se pinta «actualizado hace…»** —no hay nada que
      fechar— y **tampoco la escasez**, que ya exige un sábado ocupado. Lo que queda es un
      calendario limpio diciendo «todo libre», que es cierto y está bien: es exactamente el
      mensaje de quien empieza. Lo que **no** puede salir es un hueco ni un «—».
- [ ] **T7.13** El calendario **no va antes que el hero ni que los paquetes**. Su trabajo es
      cualificar a quien ya está convencido, no convencer.

**Tests**
- [ ] Elegir fecha y pulsar un paquete manda **fecha + paquete** en el mensaje.
- [ ] Cambiar `whatsappMessage` en Configuración cambia el CTA del calendario **y** el del día
      ocupado, no solo el del hero.
- [ ] Un paquete con `whatsappMessage` propio lo usa de base; con `null` cae al de `SiteSettings`.
      Con fecha elegida, en los dos casos el base sobrevive entero y la fecha se le suma.
- [ ] Pulsar un paquete **sin** fecha manda el mensaje de siempre — no se rompe lo que ya existe.
- [ ] Dos toques dan un rango; el tercero reinicia.
- [ ] Un día ocupado también abre WhatsApp, con el mensaje de «otra fecha».
- [ ] El número y el texto salen del **mismo** constructor en los cuatro sitios.
- [ ] Sin JavaScript, los CTA siguen llevando a WhatsApp sin fecha. El calendario es una mejora,
      no un requisito para escribirle.

---

## Task 8 · Cierre

- [ ] **T8.1** `CLAUDE.md`: «ocho pantallas» → nueve; el módulo y sus reglas; la decisión de
      horneado con su porqué; el CORS con `credentials: false` y por qué eso conserva la
      propiedad de la nota original; la medida que salga del T4.10.
- [ ] **T8.2** **Comentario muerto que sale al paso:** `env.schema.ts` dice que `CDN_BASE_URL`
      «lo lee SOLO el MediaUrlInterceptor», y ese interceptor **no existe** — `CLAUDE.md` explica
      por qué se quitó. Corregirlo a `StorageService`.
- [ ] **T8.3** `docs/openapi-public.json` regenerado y congelado en CI.
- [ ] **T8.4** `pnpm outdated` y `pnpm audit`.
- [ ] **T8.5** Suite entera en verde: unitarios, integración y Playwright **en los dos temas**.

---

## Orden y coste

| | Qué | Cuándo | Coste |
|---|---|---|---|
| 1 | CORS + `keepalive` | **primero** | ~0,5 día |
| 2–3 | Schema, contratos y API | ya | ~1,5 días |
| 4 | Hora de Perú en el Panel | ya | ~0,5 día |
| 5 | Pantalla del admin | ya | ~1,5 días |
| 6 | Panel | ya | ~0,5 día |
| 7 | Landing | **con la fase 5** | ~1,5 días |
| 8 | Cierre | al final | ~0,5 día |

**Dependencias reales, ahora que se ha verificado que el deploy no existe:**

- Los tasks 1 y 4 **no dependen de nada** y arreglan fallos que ya están ahí.
- Los tasks 2, 3, 5 y 6 dejan a James **marcando fechas desde hoy**, aunque todavía no se
  publiquen: cuando la landing exista, el calendario se estrena con datos de verdad.
- **El task 7 depende de la fase 5 (que la landing exista) Y de la fase 6 (que el deploy
  publique).** Sin la segunda, un día marcado no llega nunca a la web. Publicarlo antes sería
  poner en producción un calendario que se congela el día del despliegue — que es exactamente la
  promesa rota contra la que este plan avisa en cada página.

**Los tasks 1 y 4 no son del calendario y se hacen igual.** Son dos fallos que ya existen —el
clic que no se registra y el día que se cuenta mal— y los dos tocan la única métrica del
negocio. Que los destapara este módulo no los hace suyos.

---

## Anotado, no se construye

Vista de año · aviso de «los próximos meses figuran libres» (salta legítimamente en temporada
baja y entrena a ignorar) · contadores tipo «3 eventos este mes» (no llevan a ninguna acción, y
el número del Panel ya es el de los clics) · repeticiones semanales · Google Calendar ·
notificaciones push · estado «apalabrado» · bloquear medias jornadas.
