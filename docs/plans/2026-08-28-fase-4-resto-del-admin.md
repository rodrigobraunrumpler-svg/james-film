# Fase 4 — Resto del admin · Plan de implementación

> **Para ejecutores agénticos:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Los pasos usan checkbox.

**Goal:** Que James pueda editar **todo lo que la landing muestra** sin tocar código: sus cuatro
categorías, sus tres paquetes con sus bullets y precios, los testimonios de sus clientes y los
datos de contacto — empezando por el número de WhatsApp, que es el producto entero.

**Architecture:** La misma de la fase 3. Cuatro pantallas nuevas en `src/features`, cada una
contra su módulo de la API. La diferencia con la fase 3 es que **aquí casi todo es CRUD**: el
riesgo no es técnico, es escribir la misma pantalla cuatro veces y que las cuatro se comporten
distinto.

**Tech Stack:** Sin dependencias nuevas — y 🔶 **sin estrenar `motion` tampoco**. El borrador lo
metía «ya que está instalado», que es el argumento equivocado: `vaul` ya anima el drawer y las
hojas. Si al final ninguna pantalla lo necesita, sale del `package.json` en el Task 7.

**Spec:** `CLAUDE.md` · `docs/admin.md` · `docs/proyecto.md` §8, §9, §11, §19 · `preview.webp`

---

## Global Constraints

Todo lo de `CLAUDE.md` y de la fase 3 sigue vigente. Lo específico de esta fase:

- **Ninguna feature importa de otra.** Cuatro features nuevas van a necesitar lo mismo: si
  `paquetes` importa de `galerias`, la frontera se rompe y `nextjs-boundary-enforcer` lo canta.
  Lo compartido sube a `src/components/shared` o a `src/lib`.
- **Un solo `isHighlighted` en paquetes, forzado en la API.** En el admin son **radio buttons**,
  nunca un checkbox: un checkbox invita a marcar dos y luego a preguntarse por qué se desmarcó
  el otro solo.
- **`Testimonial.isActive` no se puede activar sin `hasConsent`.** Rechazado en la API con 422,
  y el control deshabilitado en el admin. No es validación: es la Ley 29733 (§19).
- **Precios en céntimos, siempre.** `Intl.NumberFormat('es-PE')` para mostrar, un `<input
  type="number">` en soles para editar, y la conversión en un solo sitio.
- **Ningún borrado duro sin mirar qué apunta al registro.** Ver Task 0 · D4.
- **Tablas → tarjetas apiladas bajo `md`.** Sin TanStack Table (§7 obliga a las tarjetas igual).
- 🔶 **Sin paginación en las cuatro pantallas.** Son 4 categorías, 3 paquetes, 1 ajuste y unas
  decenas de testimonios. **Paginar y reordenar son incompatibles** por el mismo motivo que el
  filtro: reordenar una página manda un subconjunto. Si algún día testimonios crece de verdad,
  el reorden pasa a *mover arriba / abajo* con un endpoint de intercambio, no a mandar la lista.
- **Toda mutación de esta fase es un "cambio sin publicar".** El `TriggerDeployInterceptor` es de
  la fase 6, pero los endpoints se escriben ya sabiendo que van a llevarlo.

## Fuera de esta fase

El **dashboard** y el disparo de deploy (fase 6). La **landing** (fase 5). El formulario de
`Lead` y los gráficos de clics (anotados, no se construyen). La pantalla de **galerías** ya está
hecha en la fase 3; aquí solo se toca si el Task 6 extrae algo de ella.

---

## Task 0 · Cuatro decisiones que van antes del código

No son tareas, son bifurcaciones. Cerrarlas después de escribir dos pantallas cuesta reescribir
las dos.

### D1 · Subir imágenes que NO son `Media` 🔴

Es el problema de verdad de esta fase. Hoy el único camino de subida es
`POST /admin/galleries/:id/media/presign`, que **crea una fila `Media` colgada de una galería**.
Pero esta fase necesita subir:

| Modelo | Campo | Qué es |
|---|---|---|
| `Category` | `coverKey` | portada de la categoría |
| `Package` | `imageKey` | foto de fondo de la tarjeta |
| `Testimonial` | `avatarKey`, `screenshotKey` | avatar y captura de WhatsApp |
| `SiteSettings` | `logoKey`, `signatureKey`, `ogImageKey` | marca |
| `SiteSettings` | `heroMediaKey`, `heroPosterKey` | **el vídeo del hero** |

Ninguno es una fila `Media`: son claves sueltas sobre otros modelos. Meterlos en `Media` sería
darles galería, orden, estado y portada que no tienen.

- [ ] **Decisión: un endpoint genérico `POST /admin/uploads/presign`.** Recibe
      `{ proposito, mimeType, sizeBytes }`, devuelve `{ key, uploadUrl }` y **no escribe en la
      base**. La clave se guarda cuando el `PATCH` de la entidad la incluye.

  **`proposito` es una lista cerrada, y el SERVIDOR decide el prefijo.** No se acepta una cadena
  de prefijo del cliente: sería dejarle elegir dónde escribe dentro del bucket.

  | `proposito` | Prefijo | Tipos | Techo |
  |---|---|---|---|
  | `PORTADA_CATEGORIA`, `IMAGEN_PAQUETE` | `covers/` | jpeg, png, webp | `MAX_IMAGE_MB` |
  | `AVATAR_TESTIMONIO` | `avatars/` | jpeg, png, webp | `MAX_IMAGE_MB` |
  | `CAPTURA_TESTIMONIO` | `screenshots/` | jpeg, png, webp | `MAX_IMAGE_MB` |
  | `LOGO`, `FIRMA` | `brand/` | **svg**, png, jpeg | 1 MB · el SVG no se normaliza |
  | `OG` | `og/` | jpeg, png | `MAX_IMAGE_MB` |
  | `HERO_VIDEO` | `videos/` | mp4 | **1.5 MB** (§4) |
  | `HERO_POSTER` | `posters/` | jpeg | `MAX_IMAGE_MB` |

- [ ] 🔶 **Corrección a `CLAUDE.md`: la lista de prefijos se queda corta.** Hoy documenta
      `videos/ photos/ posters/ screenshots/ og/ backups/`, y de las nueve claves nuevas solo dos
      tienen sitio. **Se añaden `covers/`, `avatars/` y `brand/`** a esa lista en el mismo commit
      que el endpoint, o el próximo que la lea creerá que está completa.

- [ ] ✅ **Decidido (Javier): el logo va en SVG.** Deja de ser hipótesis, así que hay tres cosas
      que hacer de verdad y no anotar:

  - [ ] 🔶 **El SVG NO pasa por `normalizarImagen`.** Ese módulo decodifica a bitmap y dibuja en
        un canvas: convertiría el vector en un PNG del tamaño que tuviera el `viewBox`, y el
        logo perdería lo único que lo hace SVG. `CampoImagen` **salta la normalización** cuando
        el tipo es `image/svg+xml` y sube el archivo tal cual. Con test, porque el síntoma sería
        "el logo se ve borroso en pantallas grandes" y nadie lo ataría a esto.
  - [ ] 🔶 **Un SVG es un documento ejecutable.** Un `<script>` dentro corre con el origen que lo
        sirve. La mitigación real **no es sanear el archivo, es el origen**: R2 se sirve desde
        el subdominio `media.` (ya previsto en los pendientes de `CLAUDE.md`), que es un origen
        distinto al de la landing. Aun con un SVG malicioso, no toca ni las cookies ni el DOM
        del sitio. **Queda como requisito del dominio, no como recordatorio del `_headers`.**
  - [ ] Comprobación barata en el navegador antes de subir: rechazar si el texto contiene
        `<script`, `onload=` o `javascript:`. **No es una frontera de seguridad** —es trivial de
        esquivar— y el comentario lo dice: sirve para el caso accidental, un export de Figma con
        metadatos raros. La frontera es el origen.
  - [ ] `MIMES_MARCA = ['image/svg+xml', 'image/png', 'image/jpeg']`: PNG se acepta igual,
        porque la firma manuscrita puede llegar escaneada.

**Los huérfanos, y hay que resolverlos en este mismo Task.** Si James sube una imagen y cierra
sin guardar, el objeto queda en R2 **sin que ninguna fila lo referencie**. El cron diario de la
fase 6 sabe limpiar `Media` con `deletedAt` y `PENDING` huérfanos; de esto no sabe nada.

- [ ] Regla escrita en `CLAUDE.md` para el cron: **un objeto bajo `covers/`, `avatars/`,
      `brand/` o `og/` con más de 24 h que no aparezca en ninguna de las nueve columnas `*Key`
      se borra.** Se escribe ahora, aunque el cron sea de la fase 6, o para entonces nadie
      recordará que existe esta categoría de huérfano.
- [ ] 🔶 **`videos/` y `posters/` quedan FUERA de ese barrido.** Ahí viven los reels, cuyas
      claves están en `Media`, y un barrido que se equivoque al leer referencias borraría el
      trabajo de James. El hero es la excepción: su clave vive en `SiteSettings`, así que el
      barrido de `videos/` tendría que mirar en dos sitios. **No merece el riesgo por un
      archivo**: el hero anterior se queda en el bucket y se borra a mano si algún día molesta.
- [ ] `signableHeaders` obligatorio, igual que en el presign de media. Sin él, alguien con la
      URL sube `text/html` bajo una clave `.jpg` y el CDN lo sirve — XSS almacenado.
- [ ] Límite por `proposito`, según la tabla de arriba. **No un único `MAX_IMAGE_MB`**: el hero
      es un vídeo, y con el techo de las imágenes colarían 15 MB de autoplay en la portada.

- [ ] **Alternativa descartada:** un presign por entidad
      (`POST /admin/categories/:id/cover/presign`). Serían **siete endpoints casi idénticos**, y
      obliga a que la entidad exista antes de poder subirle una imagen — o sea que crear una
      categoría con portada son dos pasos y un estado intermedio en pantalla.

### D2 · El vídeo del hero reusa la validación de la fase 3 🔴

`heroMediaKey` es un vídeo real: 9:16, H.264, con poster. Tiene que pasar **exactamente** por
`validarArchivo` → `inspeccionarMp4` → `extraerPoster`, o el hero de la landing será el único
vídeo del sitio sin validar.

Ese módulo vive hoy en `src/features/galerias/validacion/`. **Configuración no puede importarlo
desde ahí**: ninguna feature importa de otra.

- [ ] **Decisión: mover `validacion/` y `cola/` a `src/lib/media/`**, que es donde debieron
      estar: no son de galerías, son del dominio "subir archivos".
- [ ] Es un `git mv` más arreglar imports. **Los 109 tests de esos módulos se mueven con él y
      tienen que seguir en verde** — son la red que dice que el movimiento no rompió nada.
- [ ] La cola (`zustand`) ya es un singleton de módulo, así que sirve igual para el hero: se le
      pasa otro `galleryId`… **que no existe**. Ver Task 5, Step 4: el hero **no** pasa por la
      cola, usa el presign genérico y una subida directa. La cola resuelve concurrencia,
      reintentos y orden de ocho archivos; para un archivo único es maquinaria de sobra.

### D3 · De dónde salen los nombres de íconos

`Package.icon`, `Differentiator.icon` y `SocialLink.icon` son nombres de lucide de una **lista
cerrada de ~15**. La lista tiene que existir en tres sitios: la API (para validar), el admin
(para el `<select>`) y `apps/web` (para renderizar).

- [ ] **Decisión: la lista canónica vive en la API**, en `src/modules/settings/iconos.ts`, y se
      valida con `@IsIn(ICONOS)`. La API tiene que validar sí o sí — `whitelist` es seguridad,
      no limpieza — así que ahí no es una copia, es la fuente.
- [ ] El admin la pide a **`GET /admin/icons`** (con guard, `staleTime: Infinity`). Son quince
      cadenas que cambian una vez al año: una petición al abrir la pantalla.

  🔶 **Admin, no público, y no es cosmético:** el contrato público está congelado en CI y lo
  consume Astro. Una ruta pública que solo usa el admin lo movería sin que nadie en la landing
  la llegue a pedir jamás.
- [ ] `apps/web` la escribe en su `copy.ts`. Es build time: un nombre inválido deja un hueco
      visible en la web, y ahí sí se ve. **Duplicar quince cadenas es más barato que un paquete
      runtime nuevo**, que obligaría a las tres apps a transpilarlo.
- [ ] Fallback `?? 'link'` en los tres consumidores.
- [ ] 🔶 **En el admin, un mapa estático de componentes, no un import dinámico.**
      `lucide-react` resuelto por nombre en runtime obliga a meter el paquete entero en el
      bundle o a hacerlo `lazy`. Quince `import` estáticos dentro de un objeto pesan menos **y
      hacen imposible renderizar un nombre inválido**: si no está en el mapa, sale el fallback.

### D4 · Qué pasa al borrar

Verificado en el schema, no supuesto:

| Borras | Qué apunta ahí | Consecuencia real |
|---|---|---|
| `Category` | `Gallery.categoryId` → **Restrict** | Postgres lo impide. P2003 → 400 |
| `Package` | `PackageItem`, `PackageCategory` → Cascade | se van con él, correcto |
| `Package` | `Lead.packageId`, `WhatsappClick.packageId` → **SetNull** | **se pierde la atribución de los clics pasados** |
| `Testimonial` | nada | seguro, pero deja la captura huérfana en R2 |

- [ ] **Categorías: el mensaje dice cuántas galerías la usan.** «No se puede borrar: 4 galerías
      están en esta categoría» y no un 400 genérico. Requiere contar antes de intentar.
- [ ] **Paquetes: la acción principal es desactivar, no borrar.** Un borrado duro pone a `null`
      el `packageId` de cada `WhatsappClick`, y esos clics **son la única métrica de negocio del
      proyecto**. El borrado queda como acción secundaria y **solo se ofrece si el paquete tiene
      cero clics**; si tiene, el diálogo lo dice.
- [ ] **Testimonios: borrado duro, y el `screenshotKey` se borra de R2 en la misma operación.**
      No hay soft delete que justificar aquí, y una captura de WhatsApp con el nombre y la cara
      de una clienta **no debe sobrevivir treinta días a que James decida quitarla** (§19).

---

## Task 1 · Cimientos (API) 🔴

Tres cosas que **no** son pantallas y que si se hacen después obligan a reescribir lo de antes.

### 1A · El borrado de campos, que es un bug sistémico esperando 🔴

En la fase 4 encontré que `PATCH /admin/galleries/:id` ignoraba `eventDate: null`: con
`dto.campo ? valor : undefined`, **vaciar un campo se perdía en silencio**. Lo arreglé ahí con un
helper local.

**No era un caso de galerías.** Contados en el schema, los modelos de esta fase suman
**42 campos opcionales** que James tiene que poder borrar:

| Modelo | Opcionales |
|---|---|
| `SiteSettings` | 17 |
| `Package` | 9 |
| `Testimonial` | 9 |
| `Category` | 5 |
| `Differentiator` · `SocialLink` | 1 + 1 |

El modo de fallo es el peor que existe: **la interfaz dice «Guardado» y el dato reaparece al
recargar.** Nada falla, nada se registra, y quien lo sufre concluye que la herramienta no es de
fiar.

- [ ] Subir `fechaDeCalendario` de `galleries.service.ts` a `common/` — hoy es una función local
      de un módulo, y testimonios necesita exactamente la misma para `eventDate @db.Date`.
- [ ] Regla en `CLAUDE.md`: **en todo `PATCH`, `null` BORRA y `undefined` NO TOCA.** Nunca
      `dto.campo ? x : undefined`, que colapsa los dos casos en uno.
- [ ] Los DTO opcionales se tipan `campo?: T | null`. `@IsOptional()` ya deja pasar `null` en
      runtime; lo que faltaba era el tipo.
- [ ] **Un test por modelo que vacíe TODOS sus opcionales de una vez** y compruebe que quedan a
      `null`. Es un test por modelo, no 42: barato de escribir y encuentra el olvido entero.
- [ ] En el admin, la cadena vacía se manda como `null`, no se omite. Helper compartido, porque
      son cuatro formularios y el que se olvide no dará error.

### 1A bis · El seed sobrescribe lo que escriba James 🔴🔴 el peor de la revisión

Verificado línea a línea en `prisma/seed.ts`:

```ts
await prisma.category.upsert({ where: { slug: c.slug }, update: c,       create: c });
await prisma.package.upsert ({ where: { slug },          update: datos,  create: datos });
await prisma.differentiator.upsert({ where: { title },   update: d,      create: d });
await prisma.socialLink.upsert    ({ where: { platform },update: r,      create: r });
await prisma.siteSettings.upsert  ({ where: { id },      update: AJUSTES, ... });

await prisma.packageItem.deleteMany({ where: { packageId } });   // ← y recrea los 16
```

`update` lleva el **objeto entero**. Y `CLAUDE.md` dice que el seed *«se ejecuta en local, en
cada branch de CI **y en producción**»*.

**Lo que eso significa en cuanto exista la fase 4:** James cambia el precio del paquete Pro,
corrige su handle de Instagram y reescribe su `aboutText`. El siguiente despliegue que corra el
seed **lo devuelve todo a los valores del flyer**, incluido el número de WhatsApp. Sin error, sin
log, sin nada que lo relacione con el deploy.

Lo llamativo es que el razonamiento correcto **ya está escrito** en el mismo fichero, tres
líneas más abajo, para el usuario:

```ts
await prisma.user.upsert({ where: { email }, update: {}, ... });
// `update: {}` a propósito: si ya existe NO se le pisa la contraseña con la del entorno.
// El seed no debe poder degradar una credencial real.
```

Es exactamente el mismo principio, aplicado a la credencial y no al contenido.

- [ ] **`update: {}` en las cinco entidades de contenido.** El trabajo del seed es **crear** el
      estado inicial, no mantenerlo sincronizado. A partir de la fase 4, la fuente de verdad del
      contenido es el admin.
- [ ] **Los bullets solo se crean si el paquete se acaba de crear.** El `deleteMany` +
      `createMany` incondicional borra los que James haya editado. Se comprueba si ya tiene
      items y, si los tiene, no se toca.
- [ ] **`SEED_RESET=true`** para el caso local de «devuélvemelo al estado del flyer». Explícito,
      opt-in, y **nunca** en el comando de producción.
- [ ] Test: sembrar, cambiar un precio y un handle a mano, **volver a sembrar**, y comprobar que
      siguen cambiados. Es la única forma de que esto no vuelva.
- [ ] Regla en `CLAUDE.md`, porque hoy dice lo contrario de lo que debe hacer.

### 1B · `@AdminController`, el decorador que §5 pide y que no existe 🔴

- [ ] Verificado: **no existe.** `CLAUDE.md` lo da por hecho («`@AdminController('path')` =
      decorador compuesto con guards, interceptors y Swagger») pero los tres controllers de
      admin usan `@Controller('admin/...')` a pelo.
- [ ] **Esta fase pasa de 3 a 7 controllers de admin**, y la fase 6 tiene que meter el
      `TriggerDeployInterceptor` en todos. Con el decorador compuesto es **un fichero**; sin él,
      siete — y el que se olvide no fallará: simplemente esa pantalla no marcará cambios sin
      publicar, y James verá «0 cambios» tras editar sus precios.
- [ ] Se construye ahora y **se migran los tres existentes** en el mismo commit. Después son
      siete migraciones en vez de tres.

### 1C · Subidas fuera de la galería

Lo que era el Task 1 entero. Sale aquí porque las cuatro pantallas lo necesitan.

- [ ] **Step 1: `POST /admin/uploads/presign`** según D1. Valida el `proposito`, el mime y el
      tamaño contra la tabla, genera clave UUID **bajo el prefijo que decide el servidor**, y
      firma con `signableHeaders`. **No toca la base.**
- [ ] **Step 2: mover `validacion/` y `cola/` a `src/lib/media/`** (D2), con los 109 tests.
      `pnpm --filter admin test` en verde antes de seguir. Si algo se rompe aquí, se arregla
      aquí: arrastrarlo a las pantallas hace que parezca un fallo de las pantallas.
- [ ] **Step 3: `<CampoImagen>` compartido**, en `src/components/shared/`. Un solo componente
      para las nueve claves de imagen del proyecto:
  - miniatura actual (o hueco con `aspect-ratio` reservado),
  - botón de elegir archivo, progreso **real** durante el `PUT`,
  - normalización con `normalizarImagen` antes de subir (HEIC del iPhone → JPEG),
  - **devuelve la `key` al formulario, no la URL**: `storageKey` en la base, nunca la URL.
- [ ] **Step 4: tests.** Que el presign rechace un mime fuera de lista; que `CampoImagen`
      convierta un HEIC; que al fallar la subida el formulario **no** se quede con una clave que
      no existe en el bucket.

---

## Task 2 · Categorías

La primera pantalla y la más simple: es la que fija el patrón que copian las otras tres. Cuatro
filas fijas (Bodas, XV Años, Cumpleaños, Eventos), así que **no hay paginación**.

- [ ] **Step 1: API — `CategoriesModule`.** Ya existe `GET /admin/categories` (fase 3, para el
      selector del editor). Se amplía a módulo completo:
  - `GET /categories` público, filtrando `isActive` y ordenado, con `@SkipThrottle`
  - `GET /admin/categories`, `POST`, `PATCH /:id`, `DELETE /:id`
  - `PATCH /admin/categories/reorder` con `ReorderService`
  - [ ] 🔶 **Trampa de orden de rutas, ya nos pasó en la fase 3.** `PATCH /admin/categories/:id`
        captura `/reorder` si se declara antes. En la fase 3 el reorden colgaba de
        `/galleries/:id/media/reorder` y por eso no chocaba; estas colecciones son de primer
        nivel y sí. La ruta literal va **declarada antes** que la paramétrica, **y con un test
        que pida `/reorder` y espere 200** — el orden de los métodos es exactamente el tipo de
        detalle que alguien rompe reordenando el fichero, y sin test el síntoma sería un 404
        con aspecto de "el id no existe". Aplica igual a paquetes y testimonios.
  - Slug con `SlugService` al crear, **no se regenera al renombrar** (los enlaces de James)
  - `exists()` normal, sin `deletedAt`: `Category` no tiene soft delete
- [ ] **Step 2: el borrado cuenta primero** (D4). El servicio cuenta galerías y lanza un 409 con
      `code: 'CATEGORY_IN_USE'` y el número en el mensaje. **No se deja caer en el P2003**: el
      mensaje de Prisma no dice cuántas son, y ese número es justo lo accionable.
  - [ ] 🔶 **`CATEGORY_IN_USE` no está en la unión `ErrorCode`** (`CONSENT_REQUIRED` sí — la fase
        2 lo anticipó). Añadir un código toca **tres sitios**: la unión en `packages/contracts`,
        el `Record<ErrorCode, true>` de `envelope.entities.ts` —que no compila si se
        desincroniza— y el decorador `ApiErrors`. Es fácil descubrirlo tarde y a mitad de otra
        cosa.
- [ ] 🔶 **El conteo también mira los paquetes.** `PackageCategory` es **Cascade**, no Restrict:
      borrar una categoría **desvincula los paquetes en silencio** sin que Postgres se queje. El
      aviso los nombra: «4 galerías y 2 paquetes usan esta categoría».
- [ ] **Step 3: pantalla.** Lista ordenable con los botones de mover de la fase 3 (mismo
      componente), toggle de `isActive` **optimista**, y una hoja lateral (`vaul` bajo `md`) para
      crear y editar: nombre, tagline, descripción, portada (`CampoImagen`), meta título y meta
      descripción.
- [ ] **Step 4: el slug se enseña, no se edita a ciegas.** Se muestra bajo el nombre («se verá
      como `/galerias/bodas`») con un botón de editar y un aviso de que rompe los enlaces
      compartidos. Es la misma regla del Task 4 de la fase 3.
- [ ] **Step 5: tests.** Reorden optimista con reversión; el 409 pintado con su número; que el
      controller público no devuelva las inactivas.

---

## Task 3 · Paquetes 🔴 el más complejo de la fase

Tres paquetes, dieciséis bullets, un destacado. Es donde está el precio, o sea el CTA.

- [ ] **Step 1: API — `PackagesModule`** con público y admin, más:
  - `isHighlighted` con `ExclusiveFlagService` **sin scope** (es único global, no por galería)
  - `PATCH /admin/packages/reorder`
  - `priceAmount` validado como entero ≥ 0 (céntimos), `currency` con defecto `PEN`
  - `icon` con `@IsIn(ICONOS)` (D3)
  - `slug` con `SlugService` al crear, **sin regenerar al renombrar**
    - [ ] 🔶 **Autocorrección de la segunda pasada:** escribí que «la landing enlaza a
          `#paquete-basico` y James comparte esos enlaces». **Eso no está en ningún sitio** — la
          landing no existe todavía y lo di por hecho. Lo cierto es solo esto: `Package.slug` es
          `@unique`, se genera al crear y no se regenera, **por la misma regla general que las
          galerías**. Para qué lo usa la web lo decide la fase 5.
- [ ] **Step 2: los bullets, en una sola llamada con el paquete.** 🔴 Decisión:
      `PATCH /admin/packages/:id` acepta `items: [{ id?, text, included }]` **completo y en
      orden**, y el servicio hace en UNA transacción: `upsert` de los que traen `id`, `create`
      de los que no, `deleteMany` de los que faltan, y numera `order` por posición.

  **Por qué el array completo y no CRUD por bullet:** editar un paquete es tocar tres textos y
  reordenar dos bullets, todo junto. Con endpoints por bullet, guardar sería una ráfaga de seis
  peticiones que puede fallar a medias y dejar el paquete en un estado que James no pidió.

  **Por qué se conservan los ids** (y no delete+recreate como el seed): son la clave de React de
  cada fila. Recrearlos remonta la lista entera en cada guardado y el foco salta del campo que
  se está escribiendo.

  - [ ] 🔶 **Los ids recibidos se comprueban contra el paquete ANTES de escribir.** Un `id` de
        un bullet de otro paquete pasaría el `upsert` y **movería el bullet de sitio**. No hay
        índice único `(id, packageId)` que lo impida, así que se valida en el servicio: los ids
        que llegan tienen que pertenecer a `:id`, y si no, 400. Con test.

- [ ] **Step 3: el vínculo con categorías.** `PackageCategory` es un pivote sin campos propios:
      el `PATCH` acepta `categoryIds: string[]` y el servicio hace `deleteMany` + `createMany`
      dentro de la misma transacción. En el admin son checkboxes, no un multiselect.
- [ ] **Step 4: pantalla.** Tarjetas en `repeat(auto-fit, minmax(240px, 1fr))` — la misma regla
      que la landing (§8), **nunca `grid-cols-3`** — con el destacado marcado. La edición abre
      una hoja con: nombre, subtítulo, precio, nota de precio, ideal para, ícono, imagen, badge,
      mensaje de WhatsApp, categorías y **la lista de bullets con reorden y toggle de incluido**.
- [ ] **Step 5: el precio, SOLO ENTEROS.** ✅ **Decidido (Javier).**
      `<input type="number" step="1" min="0">` en soles, y `soles * 100` a céntimos en
      `lib/format` (`aSoles` / `aCentimos`), en un solo sitio.

  **Lo que esto elimina:** el redondeo. Con enteros, `300 * 100` es exacto y no hay
  `3009.9999999` que corregir. Se borra esa prueba del Task 7 y se queda una más simple: que
  `300` guarde `30000` y que la pantalla lo devuelva como `S/ 300.00`.

  - [ ] 🔶 **El `step="1"` no basta como validación.** El usuario puede escribir `300.5` a mano
        y el navegador lo acepta igual; `type="number"` solo valida al enviar un formulario
        nativo, y aquí no hay submit nativo. Se valida en zod (`z.number().int()`) **y en la
        API** (`@IsInt()` sobre los céntimos, que ya está). El admin puede equivocarse, la API
        no debe poder.
  - [ ] La visualización sigue con dos decimales (`S/ 300.00`): lo dice `CLAUDE.md` y es lo que
        el flyer enseña. Enteros es cómo se **edita**, no cómo se **muestra**.
- [ ] **Step 6: destacar es un radio.** Marcar uno desmarca el otro en la caché al instante
      (optimista, exclusivo), igual que la portada de la fase 3.
- [ ] 🔶 **Step 6 bis: desactivar el paquete destacado deja la landing SIN destacado.** El
      controller público filtra `isActive`, así que un paquete `isHighlighted: true` +
      `isActive: false` desaparece y **ningún otro hereda el destaque** — §8 da por hecho que
      hay uno. No falla nada: la sección simplemente sale plana.
      **El admin avisa al desactivar el destacado** («este es el paquete destacado; al
      desactivarlo la web no destacará ninguno»). Mismo caso, literalmente, que el testimonio
      destacado sin `isActive` del Task 4.
- [ ] **Step 7: tests.** Que dos paquetes no puedan estar destacados a la vez ni siquiera
      mandando dos `PATCH` seguidos; que los ids de los bullets sobrevivan a un guardado; que
      quitar un bullet lo borre y renumere el resto; que `300` guarde `30000` y que un
      `300.5` a mano sea rechazado.

---

## Task 4 · Testimonios 🔴 el único con riesgo legal

§19 lo dice claro y `CLAUDE.md` lo repite: **es el único punto que puede traerle un problema
real a James.** Hay menores en los XV años.

- [ ] **Step 1: API — `TestimonialsModule`.**
  - Público: filtra `isActive: true` **Y `hasConsent: true`**, y nunca acepta un parámetro que lo
    desactive. Con test.
  - Orden `[{ order: 'asc' }, { id: 'asc' }]` aunque no haya paginación: `order @default(0)`
    empata por defecto y sin desempate Postgres puede devolverlos en distinto orden entre dos
    builds de Astro, moviendo la sección sin que nadie haya tocado nada.
  - `hasConsent` **no sale en el DTO público**: es una condición para publicar, no un dato del
    visitante. Si un testimonio llega al contrato, es que lo tenía.
  - Admin: CRUD, reorden, y `isFeatured` con `ExclusiveFlagService` **sin scope**.
  - [ ] 🔶 **`rating` no tiene tope en el schema.** Es `Int?` a secas: un 7 sobre 5 entra en la
        base y la landing pintaría siete estrellas. `@Min(1) @Max(5)` en el DTO. No se cambia el
        schema por esto —un CHECK saldría como 500 opaco con adapter-pg, ya lo comprobamos en la
        fase 1— se valida en el DTO, que es donde el error sale legible.
  - [ ] ✅ **Decidido (Javier): uno destacado Y el resto por orden.** El destacado es **exclusivo
        —uno solo—** y los demás salen ordenados detrás. `ExclusiveFlagService` sin scope, igual
        que `Package.isHighlighted`.

        **Consecuencia en el orden público:**
        `orderBy: [{ isFeatured: 'desc' }, { order: 'asc' }, { id: 'asc' }]`, exactamente el
        mismo patrón que ya usa `listarPublicas` de galerías. El destacado sale primero **sin
        salirse de la lista**: no es una consulta aparte, es la misma con el flag arriba. Así la
        landing decide cómo pintarlo (grande el primero, o todos iguales) sin que la API
        prejuzgue el diseño de la fase 5.

  - [ ] **En el admin es un radio**, no un checkbox, por la misma razón que el paquete
        destacado: un checkbox invita a marcar dos y luego a preguntarse por qué se desmarcó el
        otro solo. Optimista y exclusivo en la caché, como la portada de la fase 3.
  - [ ] 🔶 **Un destacado sin consentimiento no puede llegar a la landing.** `isFeatured` y
        `isActive` son flags distintos: marcar destacado un testimonio **no** lo publica. El
        filtro público sigue siendo `isActive && hasConsent`, y el `orderBy` no lo salta. Con
        test, porque es justo la combinación que parece publicada en el admin y no lo está.
  - [ ] 🔶 **Añadir `Testimonial.isFeatured` a la lista de `ExclusiveFlagService` en
        `CLAUDE.md`**, que hoy nombra solo tres campos. Si no, el próximo que la lea creerá que
        está completa — que es exactamente el error que cometí en el primer borrador.
- [ ] **Step 2: la puerta del consentimiento, en el servidor.** 🔴 `PATCH` con
      `isActive: true` sobre una fila con `hasConsent: false` → **422 con
      `code: 'CONSENT_REQUIRED'`**. No es una comprobación de formulario: el admin puede
      equivocarse, la API no debe poder.
- [ ] **Step 3: la puerta en la interfaz, y que se entienda.** El toggle de publicar sale
      **deshabilitado** mientras `hasConsent` sea false, con el motivo escrito al lado — no un
      tooltip. Y marcar el consentimiento pide una confirmación explícita que diga **qué se está
      afirmando**: que la clienta dio permiso para publicar su nombre, su foto y su mensaje.
- [ ] 🔶 **Step 3 bis: con filtro activo, el reorden se DESHABILITA.** `ReorderService` numera
      `0..n-1` **solo los ids que recibe** y no toca al resto. Si la lista está filtrada por
      estado —que es justo lo que pide el Step 4— reordenar mandaría un subconjunto y los que no
      se ven conservarían órdenes que ahora colisionan: la lista pública saldría barajada sin
      que nadie lo haya pedido y sin ningún error. El botón sale deshabilitado con el motivo
      escrito («quita el filtro para reordenar»), no oculto.
- [ ] **Step 4: pantalla.** Lista con el estado bien visible (Borrador / Publicado / **Sin
      consentimiento**), filtro por estado en la URL con `nuqs`, y hoja de edición con: formato
      (texto o captura), fuente, nombre, handle, avatar, tipo y fecha de evento, cita,
      captura, enlace externo, valoración y galería asociada.
- [ ] **Step 5: el borrado se lleva la captura** (D4). Confirmación fuerte, **sin optimismo**, y
      el texto dice que la imagen se borra del servidor.
- [ ] **Step 6: tests.** El 422 del consentimiento; que el controller público no devuelva un
      testimonio sin consentimiento **aunque esté activo**; que el borrado llame al borrado del
      objeto; que `isActive` nazca en `false`.

---

## Task 5 · Configuración

Cinco pestañas, un solo registro (`SiteSettings`, `id: "singleton"`). Aquí vive el número de
WhatsApp: **el campo más importante de todo el producto.**

- [ ] **Step 1: API — `SettingsModule`.** `GET /settings` público y
      `GET|PATCH /admin/settings`. El `PATCH` es parcial sobre el singleton, con `upsert` por si
      el seed no corrió.
- [ ] **Step 2: el número de WhatsApp se valida y se prueba.** 🔴 Formato internacional **sin
      `+`**: `/^[1-9]\d{7,14}$/`. Sin prefijo, el botón de la landing no funciona y **no hay
      forma de que nadie se entere** — no falla, simplemente nadie escribe.
  - Validado en la API (422 con mensaje que muestra el formato correcto: `51994724944`).
  - En el admin, junto al campo, un enlace **«Probar este número»** que abre el `wa.me/` real.
    Es la única verificación que existe: la escribe James, con su teléfono, en dos segundos.
- [ ] **Step 3: las cinco pestañas** (`CLAUDE.md` §, sobre §9 que omitía Diferenciadores), con
      la pestaña activa en la URL vía `nuqs` para que recargar no la pierda:

  | Pestaña | Campos |
  |---|---|
  | Identidad | `brandName`, `role`, `tagline`, `slogan`, `aboutText`, `logoKey`, `signatureKey` |
  | Contacto y redes | `whatsappNumber`, `whatsappDisplay`, `whatsappMessage`, `ctaText`, `email`, y el CRUD de `SocialLink` |
  | Diferenciadores | CRUD de `Differentiator` con reorden e íconos |
  | Hero | `heroMediaKey`, `heroPosterKey`, `footerTagline` |
  | SEO | `metaTitle`, `metaDescription`, `ogImageKey` |

- [ ] **Step 4: el vídeo del hero.** Presign genérico + subida directa, **no la cola** (D2). Pasa
      por la misma validación que un reel más una regla propia: **≤ 1.5 MB y ~6 s**, porque
      autoplayea en cada visita (§4). Si se pasa, el mensaje dice el peso actual y el límite.
- [ ] **Step 5: `aboutText` es Markdown y solo usa negrita.** Un `<textarea>` con una vista
      previa que renderiza **solo** `**negrita**` — no se instala un editor ni un parser de
      Markdown para una sola marca.
  - [ ] 🔶 **La vista previa NO genera HTML.** Se parte el texto por `**` y se devuelven nodos
        React (`<strong>` en las posiciones impares). Un regex a `dangerouslySetInnerHTML` es
        una inyección esperando su turno, y da igual que el texto lo escriba James: el mismo
        campo se renderiza en la landing en build time.
- [ ] **Step 6: diferenciadores y redes son listas dentro de la pantalla**, no pantallas propias
      (decisión ya tomada en `CLAUDE.md`, contra §9). Mismo componente de lista ordenable.
- [ ] 🔶 **Step 6 bis: `Differentiator.title` y `SocialLink.platform` son `@unique`.** Crear un
      diferenciador con un título repetido, o una segunda entrada de Instagram, revienta con
      P2002 → 409. El filtro global lo convierte en `CONFLICT` con mensaje genérico, que aquí no
      dice nada: el mensaje tiene que nombrar el campo («Ya hay un diferenciador con ese
      título»). Con test, porque es la clase de detalle que se descubre usándolo.
- [ ] 🔶 **Step 6 ter: un `useForm` POR pestaña, no uno global.** Con un formulario único,
      guardar SEO mandaría también el número de WhatsApp, y `whitelist` lo aceptaría tan
      contento: pisaría un cambio hecho en otra pestaña o en otra sesión con el valor que esa
      pestaña tenía cargado. Cada pestaña manda **solo sus campos**.
- [ ] 🔶 **Step 6 quater: cambiar de pestaña con cambios sin guardar los pierde.** Es la
      consecuencia directa de no tener autoguardado aquí (Step 7). Se avisa con
      `formState.isDirty` antes de cambiar de pestaña; no se autoguarda, se pregunta.
- [ ] 🔶 **Step 6 quinquies: `whatsappNumber` y `whatsappDisplay` pueden divergir.** Uno es el
      que marca y el otro el que se enseña. Si James cambia el número y no el display, **la web
      muestra un número y llama a otro** — que para un cliente es peor que no tener número.
      El display se **propone** derivado del número (`51994724944` → `994 724 944`) y queda
      editable; si al guardar los dígitos no coinciden, se avisa. Sin bloquear: puede haber un
      motivo, pero no puede pasar sin que nadie lo vea.

- [ ] 🔶 **Step 6 sexies: una pestaña vieja pisa lo que se hizo desde el móvil.**
      `refetchOnWindowFocus: false` se decidió en la fase 3 para no gastarle datos a James en el
      móvil, y está bien. La consecuencia es que **el admin abierto en el portátil desde ayer
      tiene datos de ayer**, y un `PATCH` parcial los escribe encima de lo que él acaba de
      cambiar desde el teléfono.

      No hace falta versionado general para un usuario, pero **Configuración es el peor sitio
      para perder un cambio**: un solo registro, veinte campos y el número de WhatsApp.
      **Recomendación: `staleTime: 0` solo en esta consulta**, para que abrir la pantalla
      siempre relea. Si más adelante duele, `updatedAt` como testigo en el `PATCH` del singleton
      —412 si no coincide— es media hora de trabajo y no toca el schema.

- [ ] **Step 7: autoguardado no.** Configuración se guarda con un botón explícito por pestaña.
      El autoguardado de la fase 3 tiene sentido sobre un borrador; aquí **cada campo está en
      vivo en la web**, y guardar a los dos segundos de escribir medio número de teléfono es
      publicar un número roto.

---

## Task 6 · Extraer lo repetido — DESPUÉS, no antes

Las cuatro pantallas tienen la misma forma: lista ordenable + hoja de crear/editar + confirmar
borrado + toggle de activo.

- [ ] **Step 1: escribir Categorías y Paquetes primero, con su duplicación.** Extraer con una
      sola pantalla escrita es adivinar; con dos, se ve qué varía de verdad. Es la misma razón
      por la que §5 abstrae *comportamientos* (`ReorderService`) y no *entidades*.
- [ ] **Step 2: extraer solo lo que se repitió TRES veces.** Candidatos previstos —confirmar,
      no asumir—:
  - `<ListaOrdenable>` con los botones de mover y el reorden optimista con debounce.
    🔶 **Lo que se extrae es el HOOK, no el componente.** `use-orden-medios.ts` está atado a
    `keys.galleries.detail` y a `orden.reordenarMedios`: hay que parametrizar la clave de caché
    y el servicio. Mover el JSX sin eso deja cuatro copias del hook, que es donde está la lógica
    de reversión.
  - `<HojaEdicion>` (`vaul` bajo `md`, diálogo encima)
  - `<ConfirmarBorrado>` con texto de consecuencia, sin optimismo
  - `<ToggleActivo>` optimista con reversión
  - `useRecursoCrud(clave, servicio)` para las mutaciones repetidas de TanStack Query
- [ ] **Step 3: lo que NO se extrae.** Los formularios: cada uno tiene sus campos y su esquema
      zod, y un `<FormularioGenerico>` guiado por config es más difícil de leer que los cuatro
      formularios juntos.

---

## Task 7 · Cierre de la fase

- [ ] **Step 1: cobertura donde importa.** Alta en servicios, baja en controllers (§15). Lo
      irrenunciable: la puerta del consentimiento, el destacado exclusivo, el reorden, el
      precio entero y la validación del número de WhatsApp.
- [ ] **Step 2: ampliar el documento público a mano.** 🔶 `construirDocPublico` hoy lleva
      `include: [GalleriesModule]` **escrito a mano**. Los cuatro módulos nuevos NO aparecen
      solos: hay que añadirlos ahí o los endpoints públicos de esta fase no existirán en el
      contrato que consume Astro, y la fase 5 no los verá. El `podar()` por ruta sigue quitando
      lo de `/admin`.
- [ ] **Step 2 bis: el snapshot pasa de 2 rutas a ~6, y el diff se revisa a mano** antes de
      commitearlo. Que el CI falle aquí es lo correcto: es la frontera con la landing.
- [ ] 🔶 **Step 2 quinquies: faltan ~7 clases de entidad de Swagger.** Hoy solo existe
      `galleries.entities.ts`. Cada DTO público nuevo (`CategoryDto`, `PackageDto`,
      `PackageItemDto`, `TestimonialDto`, `SiteSettingsDto`, `DifferentiatorDto`,
      `SocialLinkDto`) necesita su clase con `implements`: es lo que hace que el contrato sea
      **tipado** y que el snapshot signifique algo. Sin ellas el documento sale con `data: {}`.
- [ ] 🔶 **Step 2 ter: `@SkipThrottle()` en los cuatro controllers públicos nuevos.** El build
      de Astro va a pedir `/categories`, `/packages`, `/testimonials` y `/settings` además de
      las galerías, todo desde una IP y en segundos. El throttler global es de 120/min: hoy
      sobra, pero el modo de fallo es el peor —el build falla y la web se queda en la versión
      vieja— y la regla de `CLAUDE.md` ya lo exige.
- [ ] 🔶 **Step 2 quater: un helper de tests de integración.** Cuatro CRUD casi idénticos son
      cuatro suites casi idénticas. Un `probarCrud({ ruta, crear, actualizar })` cubre el camino
      común (401 sin sesión, 404 inexistente, 409 duplicado, borrado de opcionales) y cada
      módulo añade solo lo suyo. Se escribe **con el segundo módulo**, no con el primero.
- [ ] **Step 3: E2E, dos flujos más.** Editar un paquete y ver el precio formateado; intentar
      publicar un testimonio sin consentimiento y que no deje.
- [ ] **Step 4: responsive.** Extender `responsive.spec.ts` a las cuatro pantallas nuevas: 320
      px sin scroll horizontal, tarjetas bajo `md`, targets de 44 px, y un texto de bullet de 80
      caracteres que no rompa la tarjeta del paquete.
- [ ] **Step 5: `pnpm outdated` y `pnpm audit`**, como al cerrar cada fase.
- [ ] 🔶 **Step 5 bis: decidir qué pasa con `Gallery.coverKey`.** Verificado: el mapper la
      respeta (`g.coverKey ?? claveDePortada(...)`) pero **no la escribe nadie y ningún DTO la
      expone**. Es una columna muerta con una lectura viva — el tipo de cosa que alguien
      «arregla» cableándola sin saber que la portada se deriva a propósito (fase 3, Task 0).
      O se cablea de verdad —y entonces entra en el barrido de huérfanos de D1— o se borra.
      **Recomendación: borrarla**, porque `claveDePortada` ya cubre el caso y una portada manual
      no está pedida en ningún sitio.
- [ ] **Step 6: actualizar `CLAUDE.md`** con lo que se aprenda, especialmente la regla del cron
      para los huérfanos de `covers/`, `avatars/` y `brand/` (D1), los tres prefijos nuevos, y
      la ubicación nueva de `lib/media` (D2).

---

## Orden y por qué

```
Task 0  decisiones            ─┐
Task 1A borrado de campos      │
Task 1B @AdminController       ├─ cimientos: más caros cuanto más tarde
Task 1C subidas genéricas     ─┘
Task 2  categorías            ← fija el patrón, es la más simple
Task 3  paquetes              ← el más complejo; con el patrón ya probado
Task 4  testimonios           ← riesgo legal, merece cabeza descansada
Task 5  configuración         ← el más ancho, pero el menos profundo
Task 6  extraer lo repetido   ← con tres pantallas escritas, no antes
Task 7  cierre
```

**Duración estimada: ~3 días y medio**, contra la semana de la fase 3. Medio día más que el
borrador por los cimientos del Task 1A y 1B, que no estaban contados. La diferencia es que aquí casi
toda la maquinaria dura ya existe: cliente HTTP, pasarela, sobre tipado, skeletons,
`ReorderService`, `ExclusiveFlagService`, `SlugService`, formato con `Intl` y el patrón de
reorden optimista. Lo único que se construye de cero es el presign genérico del Task 1.

## Hallazgos de la revisión

Diez, marcados con 🔶 en el cuerpo. **Cuatro eran fallos del primer borrador**, no mejoras:

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | Los prefijos de R2 de `CLAUDE.md` no cubren siete de las nueve claves nuevas. El borrador inventó `uploads/` para todo, sacando de su sitio a `screenshots/` y `og/`, que **ya estaban documentados** | fallo del plan |
| 2 | El `prefijo` lo mandaba el cliente. Es dejarle elegir dónde escribe en el bucket: ahora manda un `proposito` de lista cerrada y **el servidor decide** | fallo del plan |
| 3 | El techo del hero era `MAX_IMAGE_MB`. Es un **vídeo**: colarían 15 MB de autoplay en la portada de la landing | fallo del plan |
| 4 | `Testimonial.isFeatured` como exclusivo **me lo inventé**: no lo decía el schema, ni `CLAUDE.md`, ni el doc. Preguntado en vez de asumido — y Javier confirmó que sí lo es, pero la respuesta correcta por el motivo correcto | fallo del plan |
| 5 | `GET /icons` público movería el contrato congelado por una ruta que **solo usa el admin**. Pasa a `/admin/icons` | corrección |
| 6 | `PATCH /admin/categories/reorder` lo captura `:id` si se declara antes — la misma trampa de la fase 3, pero ahí no chocaba porque el reorden colgaba más hondo | corrección |
| 7 | El `upsert` de bullets aceptaría un `id` de **otro paquete** y movería el bullet: no hay índice que lo impida | corrección |
| 8 | La vista previa de `aboutText` con regex a HTML es una inyección; se devuelven nodos React | corrección |
| 9 | `Differentiator.title` y `SocialLink.platform` son `@unique`: P2002 con mensaje genérico que no dice qué campo | corrección |
| 10 | `construirDocPublico` lleva `include: [GalleriesModule]` **a mano**: los módulos nuevos no aparecen solos y la fase 5 no vería sus endpoints | corrección |

Y un límite que se decide en vez de arrastrarlo: **`videos/` y `posters/` quedan fuera del
barrido de huérfanos.** Ahí vive el trabajo de James, y un barrido que se equivoque leyendo
referencias lo borra. El hero viejo se queda en el bucket; borrarlo a mano una vez al año es más
barato que el riesgo.

## Segunda pasada — análisis a profundidad

Nueve hallazgos más, todos verificados contra el código y el schema, no de memoria. **Dos son
cimientos que cambian el orden de los Tasks.**

| # | Hallazgo | Verificado | Dónde |
|---|---|---|---|
| 11 🔴 | **El bug de `null` vs `undefined` es SISTÉMICO.** Lo arreglé en galerías creyéndolo un caso suelto; esta fase añade **42 campos opcionales** que James tiene que poder borrar. El modo de fallo es el peor: la interfaz dice «Guardado» y el dato vuelve al recargar | contados en el schema: 17 + 9 + 9 + 5 + 1 + 1 | Task 1A |
| 12 🔴 | **`@AdminController` no existe.** `CLAUDE.md` lo da por hecho; los tres controllers usan `@Controller` a pelo. La fase 4 pasa de 3 a 7 y la fase 6 mete el interceptor de deploy en todos: un fichero contra siete | `grep AdminController` → nada | Task 1B |
| 13 | Borrar una categoría **desvincula los paquetes en silencio**: `PackageCategory` es Cascade, no Restrict. El conteo previo solo miraba galerías | schema, línea 186 | Task 2 |
| 14 | **Desactivar el paquete destacado deja la landing sin destacado**, y ninguno hereda el destaque. No falla nada: la sección sale plana | el público filtra `isActive` | Task 3 |
| 15 | **`Testimonial.rating` no tiene tope.** `Int?` a secas: un 7 sobre 5 entra y la landing pinta siete estrellas | schema, línea 285 | Task 4 |
| 16 | **Un `useForm` por pestaña, no uno global.** Con uno solo, guardar SEO mandaría el número de WhatsApp y pisaría un cambio de otra pestaña | — | Task 5 |
| 17 | **`whatsappNumber` y `whatsappDisplay` pueden divergir**: la web mostraría un número y llamaría a otro. Para un cliente, peor que no tener número | dos columnas independientes | Task 5 |
| 18 | Lo que hay que extraer del reorden es el **hook**, no el componente: está atado a `keys.galleries.detail` y al servicio | `use-orden-medios.ts` | Task 6 |
| 19 | **`Gallery.coverKey` es una columna muerta con lectura viva**: el mapper la respeta, nadie la escribe, ningún DTO la expone | `grep` fuera de `src/generated` | Task 7 |

Y dos de higiene: `@SkipThrottle()` en los cuatro controllers públicos nuevos (el build de Astro
va a pedirlos todos desde una IP), y **`motion` no se estrena** «porque ya está instalado» —
`vaul` ya anima las hojas; si nadie lo necesita, sale del `package.json`.

**Consecuencia en el orden:** lo que era el Task 1 (subidas) pasa a ser **1C**. Delante van 1A
—el borrado de campos— y 1B —`@AdminController`—, porque los dos son más caros cuanto más tarde
se hagan: 1A se paga en cuatro pantallas con datos que se pierden en silencio, y 1B en siete
controllers a migrar en vez de tres.

## Tercera pasada — robustez

Nueve más. El primero es el peor de las tres pasadas y **no es de esta fase**: ya está en el
repo.

| # | Hallazgo | Verificado | Dónde |
|---|---|---|---|
| 20 🔴🔴 | **El seed sobrescribe lo que escriba James.** `update` lleva el objeto entero en las cinco entidades de contenido, y los 16 bullets se borran y recrean. `CLAUDE.md` dice que el seed corre **en producción**: el siguiente deploy devuelve precios, redes, `aboutText` y **el número de WhatsApp** a los valores del flyer. Sin error y sin log | `seed.ts` líneas 135-174 | Task 1A bis |
| 21 🔴 | **El backup deja de ser «antes de datos reales» y pasa a ser AHORA.** La fase 4 *es* el momento en que entran los datos reales. Con el hallazgo 20 al lado, un `pg_dump` sin restaurar nunca no es un backup | pendientes de `CLAUDE.md` | prerequisito |
| 22 | **Reordenar con un filtro activo produce basura.** `ReorderService` numera solo los ids que recibe; el filtro por estado de testimonios —que pide mi propio plan— manda un subconjunto y los invisibles quedan con órdenes que colisionan | `reorder.service.ts` | Task 4 |
| 23 | **Una pestaña vieja pisa lo hecho desde el móvil.** `refetchOnWindowFocus: false` es correcto para los datos de James, pero Configuración es el peor sitio para perder un cambio | `lib/query/cliente.ts` | Task 5 |
| 24 | `CATEGORY_IN_USE` no está en la unión `ErrorCode`; añadirlo toca tres ficheros | `contracts` + `envelope.entities.ts` | Task 2 |
| 25 | **Faltan ~7 clases de entidad de Swagger.** Sin ellas el contrato público sale con `data: {}` y el snapshot no significa nada | solo existe `galleries.entities.ts` | Task 7 |
| 26 | Los íconos, con **mapa estático**: resolver `lucide-react` por nombre en runtime mete el paquete entero en el bundle | — | Task 0 · D3 |
| 27 | **Paginar y reordenar son incompatibles**, por el mismo motivo que el filtro. Sin paginación en las cuatro pantallas | — | Constraints |
| 28 | **Autocorrección:** en la segunda pasada escribí que la landing enlaza a `#paquete-basico`. **Me lo inventé** — la landing no existe. El slug se justifica por la regla general, no por un uso que nadie ha definido | — | Task 3 |

**Lo que hay que hacer antes de darle el admin a James**, y no al cerrar la fase:

1. Arreglar el seed (20). Es media hora y evita el único fallo de esta fase capaz de destruir
   trabajo suyo.
2. El cron de `pg_dump` a R2 **restaurado una vez** a una branch de Neon (21). `CLAUDE.md` ya lo
   pedía «antes de datos reales»; esta es esa fase.

## Cuarta pasada — librerías 2026 y rendimiento

Con datos, no con opiniones: `pnpm -r outdated`, `pnpm audit --prod` y el tamaño real de los
chunks del build de hoy.

### Lo que SÍ hay que mirar

| # | Hallazgo | Evidencia |
|---|---|---|
| 29 | **TypeScript 7.0.2 es `latest` y estamos en 6.0.3.** `CLAUDE.md` lo retiene a propósito y Dependabot lo ignora — **pero el motivo no está escrito en ningún sitio** | `npm view typescript dist-tags.latest` |
| 31 | **`staleTime: 30_000` global es el defecto equivocado para esta fase.** Las categorías cambian una vez al año y los ajustes cada varios meses; con 30 s, cada navegación entre pantallas lo re-pide todo. En el 4G de James eso es latencia y datos gastados sin que él pida nada | `lib/query/cliente.ts` |
| 32 | **El admin sirve 1,13 MB de JS sin comprimir y no hay techo.** La fase 4 mete cuatro pantallas más, `zustand` ya entró y el mapa de íconos hará crecer `lucide-react` | medido sobre `.next/static/chunks` |

- [ ] **29 · Spike de TypeScript 7, con criterio de aceptación explícito.** TS 7 es el port nativo
      (tsgo) y NestJS resuelve la inyección con `emitDecoratorMetadata`. **Ya nos comimos ese
      fallo una vez** con `consistent-type-imports`: el linter pedía un cambio que rompía
      producción y ni el typecheck ni los tests unitarios lo detectaban, porque los tests
      construyen los servicios a mano. El criterio no es "compila", es:
      **la API arranca sin `UnknownDependenciesException` y los 94 tests de integración pasan.**
      Si falla, se escribe el motivo en `CLAUDE.md` — hoy solo dice «deliberadamente atrasadas»,
      que no le sirve a nadie dentro de seis meses.
- [ ] **31 · `staleTime` por recurso, cinco líneas y ninguna dependencia.** `Infinity` para los
      íconos, 5-10 min para categorías, paquetes y testimonios, y **0 solo para Configuración**
      (hallazgo 23: es donde una pestaña vieja hace más daño).
- [ ] **32 · Presupuesto de bundle en CI.** Un paso que sume el tamaño de `.next/static/chunks`
      y falle si sube más de un umbral. **Cero dependencias**: `find` + `awk`, que es
      exactamente como se midió el 1,13 MB de arriba. Sin techo, esto crece hasta que se nota en
      el móvil de James, que es el peor sitio para enterarse.

### Lo que NO se añade, y por qué

| Candidato | Veredicto |
|---|---|
| **React Compiler 1.0** | **No.** Es estable —`1.0.0`— y Next 16 lo declara en `peerDependencies`, así que la tentación es real. Pero lo que compra es memoización automática, y **el admin no tiene presupuesto de INP** (`CLAUDE.md`: no se indexa), mientras que la landing, que sí lo tiene y es dura, **es Astro, no React**. Optimizaría justo la app que no lo necesita. Y no habría evitado ninguno de los tres bugs de render de esta fase: los tres eran **identidad de snapshot** en `useSyncExternalStore`, no memoización |
| `@types/node` 24 → 26 | **No.** Debe seguir la major de Node, fijada en 24 LTS. Bien retenido; lo que falta es que `CLAUDE.md` diga por qué |
| `prisma` 8 | **No.** Sigue en `8.0.0-rc.12`. La regla de no-RC está para esto |
| TanStack Table | **No.** §7 obliga a tarjetas apiladas bajo `md` igual, y hablamos de ≤50 filas |
| Una librería de Markdown | **No.** Se usa **una** marca (negrita). Se parte por `**` y se devuelven nodos React |
| DOMPurify para el SVG | **No.** La frontera del SVG es **el origen** (`media.`), no el saneado. Un saneador da sensación de seguridad y se esquiva |
| `@tanstack/react-form` | **No.** `react-hook-form` funciona y ya está integrado con zod en cuatro pantallas |
| `prisma-extension-pagination` | **No.** `paginar()` es propio y son 30 líneas; de esa librería solo se tomaron prestados **los nombres** de los campos |

### Índices: explícitamente, no tocar

Verificado: `@@index([isActive, order])` existe en `Category`, `Package`, `Testimonial`,
`Differentiator` y `SocialLink`. Y aunque no existiera: son 4 + 3 + decenas + 1 filas. Postgres
las recorre en microsegundos. **Se deja escrito que NO hay que tocarlos**, para que nadie los
"optimice" en una revisión futura creyendo que ayuda.

`pnpm audit --prod`: **sin vulnerabilidades**. Las minor pendientes
(`@vitejs/plugin-react` 6.1.0→6.1.1, `@aws-sdk` 3.1119→3.1120) ya están aplicadas.

## Decisiones de Javier (cerradas)

| # | Pregunta | Respuesta | Qué cambia en el plan |
|---|---|---|---|
| 1 | ¿Testimonio destacado, o todos por orden? | **Los dos**: uno destacado y el resto ordenado detrás | `ExclusiveFlagService` sin scope, `orderBy` con `isFeatured` primero, radio en el admin, y `isFeatured` añadido a la lista de `CLAUDE.md` |
| 2 | ¿Logo en SVG? | **Sí, y la imagen ya existe** | El SVG salta `normalizarImagen` (o el vector acaba en PNG); el origen `media.` pasa de pendiente a requisito; `MIMES_MARCA` con svg + png |
| 3 | ¿Precios con decimales? | **Solo enteros** | `step="1"`, `z.number().int()`, y fuera la prueba de redondeo. Se sigue **mostrando** `S/ 300.00` |

## Riesgos

| Riesgo | Señal temprana | Salida |
|---|---|---|
| Los huérfanos de `covers/`, `avatars/` y `brand/` se olvidan hasta la fase 6 | ninguna: no falla nada | la regla del cron se **escribe** en el Task 1, no se recuerda |
| Mover `lib/media` rompe la fase 3 en silencio | los 109 tests | no se sigue al Task 2 sin ellos en verde |
| Cuatro pantallas divergentes | la tercera se escribe distinta a la primera | Task 6, y hacerlo con tres, no con una |
| El número de WhatsApp queda mal guardado | **ninguna: no falla, nadie escribe** | validación en la API + botón de probar |
| Borrar un paquete pierde los clics | ninguna hasta el dashboard de la fase 6 | desactivar es la acción principal (D4) |
| Un campo opcional no se puede vaciar | **ninguna**: la interfaz dice «Guardado» | Task 1A: la regla, el helper y un test por modelo que vacíe todos sus opcionales |
| La fase 6 se olvida el interceptor en algún controller | «0 cambios sin publicar» tras editar precios | Task 1B: `@AdminController`, un fichero en vez de siete |
| El display del WhatsApp diverge del número | ninguna hasta que un cliente marca y no es | se propone derivado y se avisa si los dígitos no cuadran |
| Un deploy resetea el contenido de James | **ninguna**: nada falla, los valores vuelven al flyer | Task 1A bis: `update: {}` y un test que siembre dos veces |
| Reordenar con filtro deja la lista pública barajada | ninguna: no hay error | el reorden se deshabilita con filtro activo, con el motivo escrito |
| El logo SVG se sube normalizado y sale rasterizado | «se ve borroso en pantallas grandes», y nadie lo ata a la subida | `CampoImagen` salta la normalización para `image/svg+xml`, con test |
