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

**Tech Stack:** Sin dependencias nuevas. Todo lo de la fase 3 más `motion` para las
transiciones de las hojas, que ya está instalado y aún no se usa.

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
  | `LOGO`, `FIRMA` | `brand/` | jpeg, png, **svg** | 1 MB |
  | `OG` | `og/` | jpeg, png | `MAX_IMAGE_MB` |
  | `HERO_VIDEO` | `videos/` | mp4 | **1.5 MB** (§4) |
  | `HERO_POSTER` | `posters/` | jpeg | `MAX_IMAGE_MB` |

- [ ] 🔶 **Corrección a `CLAUDE.md`: la lista de prefijos se queda corta.** Hoy documenta
      `videos/ photos/ posters/ screenshots/ og/ backups/`, y de las nueve claves nuevas solo dos
      tienen sitio. **Se añaden `covers/`, `avatars/` y `brand/`** a esa lista en el mismo commit
      que el endpoint, o el próximo que la lea creerá que está completa.

- [ ] 🔶 **El SVG del logo y la firma es la única entrada de SVG del proyecto.** Un SVG es un
      documento ejecutable: si el CDN lo sirve como `image/svg+xml`, un `<script>` dentro corre
      con el origen del que lo sirve. Solo lo sube James, pero el fallo no depende de quién sube
      sino de qué se sirve. **Decisión: se acepta**, y queda como requisito escrito para el
      `_headers` de la fase 6, no como recordatorio.

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

## Task 1 · Subidas fuera de la galería (API + admin)

Sale primero porque las cuatro pantallas lo necesitan y porque es lo único con riesgo real.

- [ ] **Step 1: `POST /admin/uploads/presign`** según D1. Valida mime y tamaño, genera clave
      UUID bajo `uploads/`, firma con `signableHeaders`. **No toca la base.**
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
  - `slug` con `SlugService` al crear, **sin regenerar al renombrar** (mismo motivo que las
    galerías: la landing enlaza a `#paquete-basico` y James comparte esos enlaces)
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
- [ ] **Step 5: el precio.** `<input type="number" step="0.01">` en soles, conversión a céntimos
      en el `onSubmit` **y en un solo sitio** (`aSoles` / `aCentimos` en `lib/format`), con
      pruebas de redondeo: `30.1` debe dar `3010`, no `3009.9999`.
- [ ] **Step 6: destacar es un radio.** Marcar uno desmarca el otro en la caché al instante
      (optimista, exclusivo), igual que la portada de la fase 3.
- [ ] **Step 7: tests.** Que dos paquetes no puedan estar destacados a la vez ni siquiera
      mandando dos `PATCH` seguidos; que los ids de los bullets sobrevivan a un guardado; que
      quitar un bullet lo borre y renumere el resto; el redondeo del precio.

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
  - Admin: CRUD y reorden.
  - [ ] 🔶 **`Testimonial.isFeatured` NO se marca como exclusivo.** Lo di por hecho en el primer
        borrador y no lo dice nadie: `CLAUDE.md` limita `ExclusiveFlagService` a
        `Package.isHighlighted`, `Gallery.isFeatured` y `Media.isFeatured`, y el doc no habla de
        un testimonio destacado. Se deja como booleano simple. **Pregunta abierta para Javier:**
        ¿la landing enseña un testimonio destacado, o los enseña todos por orden?
- [ ] **Step 2: la puerta del consentimiento, en el servidor.** 🔴 `PATCH` con
      `isActive: true` sobre una fila con `hasConsent: false` → **422 con
      `code: 'CONSENT_REQUIRED'`**. No es una comprobación de formulario: el admin puede
      equivocarse, la API no debe poder.
- [ ] **Step 3: la puerta en la interfaz, y que se entienda.** El toggle de publicar sale
      **deshabilitado** mientras `hasConsent` sea false, con el motivo escrito al lado — no un
      tooltip. Y marcar el consentimiento pide una confirmación explícita que diga **qué se está
      afirmando**: que la clienta dio permiso para publicar su nombre, su foto y su mensaje.
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
  - `<ListaOrdenable>` con los botones de mover y el reorden optimista con debounce
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
      redondeo del precio y la validación del número de WhatsApp.
- [ ] **Step 2: ampliar el documento público a mano.** 🔶 `construirDocPublico` hoy lleva
      `include: [GalleriesModule]` **escrito a mano**. Los cuatro módulos nuevos NO aparecen
      solos: hay que añadirlos ahí o los endpoints públicos de esta fase no existirán en el
      contrato que consume Astro, y la fase 5 no los verá. El `podar()` por ruta sigue quitando
      lo de `/admin`.
- [ ] **Step 2 bis: el snapshot pasa de 2 rutas a ~6, y el diff se revisa a mano** antes de
      commitearlo. Que el CI falle aquí es lo correcto: es la frontera con la landing.
- [ ] **Step 3: E2E, dos flujos más.** Editar un paquete y ver el precio formateado; intentar
      publicar un testimonio sin consentimiento y que no deje.
- [ ] **Step 4: responsive.** Extender `responsive.spec.ts` a las cuatro pantallas nuevas: 320
      px sin scroll horizontal, tarjetas bajo `md`, targets de 44 px, y un texto de bullet de 80
      caracteres que no rompa la tarjeta del paquete.
- [ ] **Step 5: `pnpm outdated` y `pnpm audit`**, como al cerrar cada fase.
- [ ] **Step 6: actualizar `CLAUDE.md`** con lo que se aprenda, especialmente la regla del cron
      para los huérfanos de `uploads/` (D1) y la ubicación nueva de `lib/media` (D2).

---

## Orden y por qué

```
Task 0  decisiones          ─┐
Task 1  subidas genéricas   ─┴─ bloquean a las cuatro pantallas
Task 2  categorías            ← fija el patrón, es la más simple
Task 3  paquetes              ← el más complejo; con el patrón ya probado
Task 4  testimonios           ← riesgo legal, merece cabeza descansada
Task 5  configuración         ← el más ancho, pero el menos profundo
Task 6  extraer lo repetido   ← con tres pantallas escritas, no antes
Task 7  cierre
```

**Duración estimada: ~3 días**, contra la semana de la fase 3. La diferencia es que aquí casi
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
| 4 | `Testimonial.isFeatured` como exclusivo **me lo inventé**: no lo dice el schema, ni `CLAUDE.md`, ni el doc. Queda como booleano simple y como pregunta abierta | fallo del plan |
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

## Preguntas abiertas para Javier

1. **¿Hay testimonio destacado en la landing**, o se muestran todos por orden? (hallazgo 4)
2. **El logo y la firma en SVG**: ¿los tendrá James en SVG de verdad, o habrá que aceptar PNG?
   Cambia el `proposito` `LOGO`/`FIRMA` y la nota de seguridad de D1.
3. **¿El precio se edita en soles con decimales** (S/ 300.50) o solo enteros? Si son enteros, el
   redondeo del Task 3 Step 5 sobra.

## Riesgos

| Riesgo | Señal temprana | Salida |
|---|---|---|
| Los huérfanos de `covers/`, `avatars/` y `brand/` se olvidan hasta la fase 6 | ninguna: no falla nada | la regla del cron se **escribe** en el Task 1, no se recuerda |
| Mover `lib/media` rompe la fase 3 en silencio | los 109 tests | no se sigue al Task 2 sin ellos en verde |
| Cuatro pantallas divergentes | la tercera se escribe distinta a la primera | Task 6, y hacerlo con tres, no con una |
| El número de WhatsApp queda mal guardado | **ninguna: no falla, nadie escribe** | validación en la API + botón de probar |
| Borrar un paquete pierde los clics | ninguna hasta el dashboard de la fase 6 | desactivar es la acción principal (D4) |
