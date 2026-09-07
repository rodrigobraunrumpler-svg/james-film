# Fase 5 — La landing · Plan de implementación

> **Para ejecutores agénticos:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Los pasos usan checkbox.

**Goal:** La web pública de James. Tiene **un solo trabajo**: que quien entre pulse el botón
verde. Todo lo demás —galerías, paquetes, testimonios, el calendario— existe para que ese clic
ocurra y para que llegue mejor informado.

**Architecture:** Astro **estático** en Cloudflare Pages. Los datos se piden a la API pública
**en tiempo de build** y quedan horneados en el HTML; el navegador no habla con la API salvo para
registrar el clic. Cero servidor, cero base de datos en runtime.

**Tech Stack:** Astro 7 + Tailwind 4, que ya están. **Se añaden tres dependencias y ninguna más**
(§ *Dependencias*, abajo). **No entra React.**

**Spec:** `CLAUDE.md` · `docs/proyecto.md` §1, §6, §7, §8, §17, §19, §20 · `preview.webp` ·
`docs/plans/2026-08-31-calendario-disponibilidad.md`

---

## Quién entra en esta web

**Esto manda sobre todas las decisiones de abajo, así que va primero.**

No entra un desarrollador. Entra la madre de la novia, de 55 años, en un móvil, a pleno sol en
Ayacucho, con 4G irregular, y **le da miedo pulsar cosas que no sabe qué hacen**. Lo sabemos por
una conversación real de James con una clienta:

```
Clienta 10:54  Me envía los paquetes por favor
James   10:55  Qué fecha será señorita su boda
Clienta 10:55  24 de octubre
Clienta 10:56  Quiero para dos días
James   11:19  Los dos días será               ← 23 MINUTOS DESPUÉS
```

Tres cosas que salen de ahí y que la landing tiene que resolver:

1. **«Me envía los paquetes por favor» se pide porque no hay web.** Ese mensaje debe dejar de
   llegar: los paquetes tienen que estar visibles, completos y comparables sin escribir a nadie.
2. **Veintitrés minutos de espera.** La web trabaja mientras James no puede contestar.
3. **La primera pregunta de James es la fecha.** El calendario (fase posterior) la adelanta.

Consecuencias de diseño, **no negociables**:

- **El cuerpo NO son los 13 px del admin.** Aquello es un panel denso para un experto diario;
  esto lo lee alguien una vez, deprisa y con el sol de cara. **Base 17 px**, línea 1.6, y
  titulares con `clamp()`.
- **Objetivos táctiles de 48 px**, no 44. Los 44 de §7 son el mínimo del admin, donde James sabe
  dónde está todo.
- **Nada que exista SOLO en `:hover`.** En un móvil no hay hover, y quien no es nativo digital no
  descubre lo que está escondido. Si algo se puede pulsar, se ve que se puede pulsar.
- **Cada acción dice qué va a pasar ANTES de pulsarla.** Ver § *Las pistas*.
- **Contraste por encima de AA**, medido sobre el fondo real **y en los dos temas**. El sol de
  Ayacucho no perdona.

---

## Los DOS temas

**Cambio de decisión, 31-ago-2026.** Este plan decía en su primera versión «la landing es oscura,
punto». Se revisó al ver los diseños y **la landing lleva los dos temas**, por el mismo argumento
que ganó en el admin: el público entra desde un móvil, **a pleno sol en Ayacucho**, y un negro al
100 % de brillo se lee peor que un blanco. Además, un sitio que fuerza oscuro cuando el teléfono
está en claro se siente ajeno.

**El oscuro sigue siendo la marca** —el flyer es oscuro y dorado, y el vídeo se ve mejor sobre
negro—, así que es el que manda cuando no hay preferencia declarada.

Y **el claro NO es el oscuro invertido**, exactamente igual que en el panel:

- **El titular del hero no va sobre el vídeo.** En oscuro se apoya en un velo negro; en claro ese
  velo no existe, así que el reel es una **tarjeta** y el titular va **debajo**, en texto oscuro.
- **Los reels siguen siendo oscuros en los dos temas.** Son vídeo: su fondo es el material, no la
  superficie de la página.
- **El latón de leer baja a `#8A6D3B`.** El `#C9A96A` de la marca da **1.8:1** sobre blanco. Es el
  mismo par que el admin: uno para texto e iconos, otro —el de la marca— para rellenos.
- **La insignia del Pro se invierte**: latón sólido con texto claro en oscuro, bronce con texto
  blanco en claro.
- **El pie se queda oscuro en los dos.** Cierra la página con la marca y separa el cierre del
  contenido sin una línea.

**Coste:** duplica el test de contraste y el de capturas. `e2e/responsive-total.spec.ts` del admin
ya compone el fondo real capa a capa en dos temas — aquí se hace igual, y por eso no es gratis.
La paleta clara completa está en el tablero *Vocabulario visual* del canvas de diseño.

---

## Las pistas

Es una petición explícita de Javier y merece su propia sección: *«son personas mayores de edad y
necesitan hints, pistas, pero con precisión para que se ayuden»*.

**La regla, que ya se ganó en el admin con `Campo.ayuda`: una pista dice lo que VA A PASAR, no lo
que la cosa es.** «Botón de WhatsApp» no ayuda a nadie. «Se abre WhatsApp con el mensaje ya
escrito» quita el miedo a pulsar, que es la fricción de verdad.

| Dónde | Qué dice | Por qué |
|---|---|---|
| Bajo el CTA principal | «Se abre tu WhatsApp con el mensaje ya escrito. Preguntar no cuesta nada.» | El miedo no es al precio, es a comprometerse al pulsar |
| Sobre los paquetes | «Compáralos y dime cuál te encaja. Si ninguno, lo armamos a tu medida.» | Evita el abandono de quien no se ve en ninguno |
| En un precio | «Precio referencial. Cambia según distancia y duración.» | James lo pregunta igual; decirlo antes evita la decepción |
| En la galería | «Así se entrega. Es lo que te llega al celular.» | «Reel» no significa nada para quien no lo usa |
| En el calendario | «Toca el día de tu evento.» | Sin esto, la rejilla es decorativa |
| En un día ocupado | «Ese día ya está tomado. Toca para preguntar por otra fecha.» | Convierte el rechazo en conversación |

**Y lo que NO se hace**: llenar la página de asteriscos y notas al pie. Una pista por acción, la
que quita la duda que frena. Si hay dos pistas seguidas, sobra una.

---

## Dependencias

Tres, verificadas contra npm el 31-ago-2026. **Ninguna más.**

| Paquete | Versión | Para qué | Última publicación |
|---|---|---|---|
| `gsap` | 3.15.0 | Animaciones de scroll. Ya elegida en §6 | abr-2026 |
| `lenis` | 1.3.26 | Scroll suave, **solo ≥1024 px** | ago-2026 |
| `vanilla-calendar-pro` | 3.3.1 | El calendario (fase posterior) | ago-2026 |

**Por qué `vanilla-calendar-pro` y no `react-day-picker`**, que ya está en el admin: **`apps/web`
no tiene React** (verificado: `astro.config.mjs` solo lleva Tailwind y sitemap). Traerlo
significa `@astrojs/react` + `react` + `react-dom` + `react-day-picker` ≈ **60 KB de JS** en una
página estática cuyo único trabajo es un clic, con presupuesto de INP medido en CrUX y clientes
en 4G. `vanilla-calendar-pro` no tiene peer-dependencies y hace lo mismo.

**En el admin se queda `react-day-picker`.** Dos librerías de calendario en el mismo repo es
correcto aquí: son dos aplicaciones con dos runtimes y dos públicos. Meter la misma en los dos
obligaría a poner React en la landing, que es justo lo que se evita.

**NO entra un kit de componentes.** §6 lo dice y sigue siendo verdad: son ocho componentes, y un
kit da comportamiento, no belleza. Lo «moderno» sale del Task 0, no de un `package.json`.

**Fuentes autoalojadas** (Bricolage Grotesque 400/800 + Inter 400/500), en `woff2`, con
`preload` y `font-display: swap`. **Nunca desde Google Fonts**: es una petición a otro dominio en
el camino del LCP y una fuga de datos de quien visita. Y nada de la API de fuentes experimental
de Astro — `CLAUDE.md` prohíbe lo experimental en producción.

---

## Lo que NO se construye

Formulario de contacto (§1: **el clic a WhatsApp ES el lead**) · blog · buscador · multi-idioma ·
carrito · área de cliente
· descarga de galerías · comentarios · newsletter.

**El calendario NO entra en esta fase.** Tiene su propio plan y depende además de que el deploy
automático exista (fase 6). Lo que sí se hace aquí es **dejarle el hueco reservado** y el
constructor de mensajes de WhatsApp preparado para que la fecha se le sume sin tocar nada.

---

## Global Constraints

Todo lo de `CLAUDE.md` sigue vigente. Lo específico de esta fase:

- **Presupuesto de rendimiento, medido en CrUX, no a ojo:** LCP < 2,5 s · **INP < 200 ms con las
  animaciones puestas** · CLS < 0,1.
- **Animaciones SOLO `transform` y `opacity`.** Nunca `top`, `left`, `width` ni `height`. Todo
  dentro de `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.
- **`client:visible`, nunca `client:load`.** Y Lenis solo por encima de 1024 px.
- **`aspect-ratio` reservado en toda imagen y vídeo**, sin excepción. Es el CLS.
- **Tres anchos de imagen en todo el sitio: 400, 800, 1600.** Ni uno más.
- **Sin autoplay en la rejilla.** Solo el hero: bucle de 6 s, ~1,5 MB, silenciado, `playsInline`.
- **La paleta es la de §6** —`void #0A0908`, `surface`, `elevated`, `line`, `ash`, `bone`,
  `brass-200/400/600`, `whatsapp #25D366`—. **El cian y el magenta del flyer NO se usan.**
- **El build aborta ante cualquier respuesta no-2xx de la API.** Un deploy fallido es mejor que
  uno con la web vacía. Y el mensaje de error dice **qué endpoint** falló.
- **Los controllers públicos ya llevan `@SkipThrottle()`**: el build hace decenas de peticiones
  desde una IP en segundos. Si aparece un 429 durante un build, es que a alguno le falta.
- **320 px sin scroll horizontal · 768 vertical · zoom 200 % · móvil horizontal.** Igual que el
  admin, con `minmax(0,1fr)` en toda rejilla y `overflow-wrap: anywhere` en texto de usuario.

---

## Task 0 · Diseño · ✅ HECHO

Los prototipos están aprobados y son **la referencia literal**: donde el código y el prototipo
discrepen, se ajusta el código. Viven en `docs/mockups-web/` como `.dc.html` más `canvas.json`,
la misma forma que los del admin.

| Artboard | Qué es |
|---|---|
| `Main.dc.html` | Landing completa, móvil, oscuro — **la referencia** |
| `Escritorio.dc.html` | Landing completa, 1440px, oscuro |
| `Calendario.dc.html` | El módulo de disponibilidad y sus seis estados |
| `Galeria.dc.html` | La página de un trabajo |
| `Piezas.dc.html` | Las dos paletas, tipografía, botones, estados vacíos |
| `Seo.dc.html` | Cómo se ve en Google y al compartir por WhatsApp |
| `*Claro.dc.html` | **Se GENERAN**, no se editan — ver abajo |

- [ ] **T0.5** **Los claros no se escriben: `node docs/mockups-web/derivar-claro.mjs`.** Se
      mantuvieron a mano y se quedaron atrás **dos veces**. Ahora solo puede cambiar el color; la
      estructura es la misma por construcción.

---

## El sistema que sale de los prototipos

**Esto es lo que hay que respetar para que el código salga igual que el diseño.**

### Inventario de secciones, en orden

**Móvil (18):** tira de contexto · barra · menú de píldoras · hero · confianza · tira de reels ·
cómo funciona · diferenciadores · qué recibes · categorías · galerías · paquetes · **calendario**
· testimonios · preguntas · sobre mí · cierre · barra pegada.

**Escritorio (14):** barra de dos alturas · hero con abanico · confianza · bento · cómo funciona ·
categorías · trabajos · qué recibes · paquetes · **calendario** · preguntas · sobre mí +
testimonios · cierre · pie.

El **calendario** se dibuja en su sitio pero **su lógica es de la fase posterior**: aquí se
maqueta la sección y se deja el `id="calendario"` al que ya apuntan la barra y el hero.

### Las diez reglas que salieron dibujando

1. **El hero DICE QUÉ VENDE.** «Transformo momentos en historias» es la marca, no la oferta.
   Debajo va, siempre: *«Reels y aftermovies para bodas, XV años y cumpleaños. Los primeros, en
   24 horas.»* Sin esa línea, quien entra frío no sabe si son fotos, vídeo o bodas.
2. **El CTA del hero entra ENTERO por encima del pliegue en un iPhone.** 844 de alto menos ~171
   de cromo dejan 673: el hero mide 640 por eso, no por estética. **Hay test.**
3. **Todo fondo oscuro DECLARA su color de texto, nunca lo hereda.** Heredarlo funciona en
   oscuro por accidente —la raíz ya es clara— y en claro deja **texto negro sobre negro**. Se
   coló cuatro veces en los prototipos: el hero, la cifra del bento, el panel de cierre y las
   portadas de categoría. En Tailwind: la clase de color va en el mismo elemento que la de fondo.
4. **Un bloque oscuro en tema claro va como PANEL** —redondeado y con margen—, nunca a sangre.
   A sangre se lee como un fallo de render; con margen se lee como una decisión. Javier preguntó
   si era un bug, y esa duda es la prueba.
5. **Los reels y las portadas se quedan oscuros en los DOS temas.** Su fondo es el material, no
   la superficie de la página.
6. **Nada de estadísticas sin respaldo.** Se quitaron cinco estrellas del hero: sin nota media y
   sin número de valoraciones afirmaban un «5,0» que nadie ha dicho. Las de un testimonio sí se
   quedan — ahí son la valoración real de esa persona, y que falten en otro es correcto.
7. **Objetivos táctiles de 48px, y el calendario el primero.** Es el módulo hecho para que
   alguien toque **un día concreto** en un móvil.
8. **Tres radios y ninguno más**: 6 (chip), 12 (control), 16+ (tarjeta y panel). En los
   prototipos llegaron a convivir seis y se notaba que nada casaba.
9. **Cada acción lleva su pista debajo**, y dice lo que VA A PASAR. Una por acción: si hay dos
   seguidas, sobra una.
10. **Cada entrada del menú es una salida.** Cuatro y no más: Trabajos · Paquetes · Fechas libres
    · Testimonios. Diferenciadores y Categorías se cruzan bajando, no se navegan.

### El movimiento, tal cual está en los prototipos

Cuatro animaciones y ninguna más, **todas `transform` y `opacity`**, todas dentro de
`prefers-reduced-motion`:

| Nombre | Qué hace | Dónde |
|---|---|---|
| `sube` | entrada, 620ms, `translateY(18px)` + opacidad | tarjetas y bloques, con `--i` |
| `desliza` | tira infinita de reels, 26s lineales | «lo último que entregué» |
| `latido` | el punto de «grabando», 2,1s | píldoras de estado |
| `brilla` / `flota` | aura que respira y reels que flotan desfasados | hero |

**La cascada lleva techo de seis pasos** (`min(var(--i), 6)`): con veinte tarjetas, la última
llegaría casi dos segundos tarde.

---

## Task 1 · Cimientos · ✅ HECHO

- [x] **T1.1** `astro.config.mjs`: `site` (para el sitemap y las URL canónicas), `output: 'static'`
      explícito, `build.inlineStylesheets: 'auto'`.
- [x] **T1.2** **La paleta de §6 en `@theme` de Tailwind 4**, en el CSS — no en un
      `tailwind.config.ts`, que es sintaxis de Tailwind 3. **Y la clara en
      `:root[data-tema='claro']`**, con el mismo script bloqueante en el `<head>` que usa el
      admin: leerlo en un efecto pinta oscuro y salta a claro.
- [x] **T1.3** Fuentes autoalojadas en `public/fonts/`, `@font-face` con `font-display: swap` y
      `<link rel="preload">` solo de la que entra en el LCP (el titular del hero).
- [x] **T1.4** `src/content/copy.ts`: **todos los textos de sección que James NO edita**. Los que
      sí edita vienen de la API. Un texto en dos sitios es un texto que se contradice.
- [x] **T1.5** **Cliente de la API para el build**, en un solo módulo. Tipado con
      `@james-film/contracts` — si la API cambia el contrato, el build **no compila**.
      Aborta con un error que **nombra el endpoint**; sin eso, «build failed» no dice nada.
- [x] **T1.6** `Layout.astro`: `<html lang="es-PE">`, meta viewport, la paleta, el pie, y los
      `<slot>` de SEO.
- [x] **T1.7** `lib/fechas.ts` con su test. **Sin librería de fechas**: Perú es UTC−5 fijo sin
      horario de verano, y eso borra el 90 % de para lo que existen. En `YYYY-MM-DD` el orden
      alfabético **es** el cronológico, lo que sobra casi todo lo demás.
- [x] **T1.8** `lib/imagen.ts`: los tres anchos (400/800/1600) y el `srcset`, en un solo sitio.


**Lo que salió construyéndolo:**

- **`Intl` en español no dice lo que uno supone.** `mesYAno` devolvía «octubre **de** 2026» —
  correcto en una frase, sobra en una cabecera— y `largo` metía una coma («sábado, 24 de
  octubre») que parte la lectura dentro del mensaje de WhatsApp. Los dos tests fallaron a la
  primera y por eso existen.
- **`numeric: 'auto'` dice «anteayer», no «hace 2 días»**, y es mejor: es lo que diría una
  persona. El test que esperaba el número estaba mal, no la función.
- **Las dos fuentes son VARIABLES**: un fichero por familia cubre todo el rango de peso.
  124 KB las dos, solo subconjunto latino, y solo se precarga la del titular — precargarlo todo
  compite consigo mismo. `crossorigin` es obligatorio aunque sean del mismo origen, o el
  navegador descarga el fichero dos veces.
- **El cliente del build usa `GalleryListItemDto`, el PÚBLICO.** La primera versión cogió el de
  admin, que lleva `isPublished`: aquí siempre valdría `true` y se colaría en la web al añadir un
  campo. Es exactamente el fallo que la API ya tuvo una vez.
- **`scroll-padding-top` en el `html`.** Sin él, la barra pegajosa tapa el título al saltar con
  un ancla — en cada clic del menú.

---

## Task 2 · El hero · ✅ HECHO

Es el LCP. Todo lo que se haga aquí se paga en la métrica.

- [x] **T2.1** Vídeo `muted playsInline loop autoplay preload="metadata"` con **`poster`
      obligatorio** — el póster es el LCP, no el vídeo.
- [x] **T2.2** `aspect-ratio` reservado. Sin él, el vídeo empuja el titular al cargar.
- [x] **T2.3** **La línea de oferta va SIEMPRE**, bajo el titular. Sale de `copy.ts`, no de la
      base: es la promesa del negocio, no un ajuste.
- [x] **T2.4** **El CTA entra entero por encima del pliegue en un iPhone.** Hero a 640 en móvil.
      Con test que mide dónde empieza el botón a 390×844.
- [x] **T2.5** **La prueba social del hero: un hecho y una fecha, sin estrellas.**
      «30 eventos grabados · 3 sábados libres», y lo segundo enlaza a `#calendario`.
      El recuento sale de la API; **si viene a cero, la línea no se pinta**.
- [x] **T2.6** **En escritorio, TRES reels en abanico**, girados ±9°, el central mayor y elevado,
      cada uno con el nombre de su trabajo. Tres cajas vacías son decoración; tres trabajos con
      nombre son prueba. Salen de los tres últimos medios publicados.
- [x] **T2.7** **En claro el hero cambia de ESTRUCTURA, no de color**: sin velo, el reel es una
      tarjeta y el titular va debajo. Es la única excepción a que los dos temas compartan
      maqueta, y está escrita en `derivar-claro.mjs`.
- [x] **T2.8** Sin vídeo, el hero funciona: cae al póster, y sin póster al degradado.
- [x] **T2.9** `prefers-reduced-motion`: el vídeo no autoplayea y se queda el póster.

**Lo que salió construyéndolo:**

- **El degradado de abajo NO basta como velo.** Con una portada clara —un flyer rosa, un vestido
  blanco— la línea de arriba quedaba ilegible, y **la portada la elige James, no nosotros**. Va
  un `bg-void/35` plano por debajo del degradado: un suelo garantizado pase lo que pase encima.
  Solo se ve poniendo una portada real; con el degradado de marcador parecía correcto.
- **El tema claro del hero de escritorio sale SOLO**, sin nada especial: los tokens hacen el
  trabajo. La excepción estructural del prototipo es únicamente el hero MÓVIL, donde el velo
  desaparece — y eso se resuelve con una rama `lg:`, no con un fichero aparte.
- **El aura del hero va dentro de un recortador.** Un círculo de 720px colocado con `right` mete
  scroll horizontal en TODA la página si se sale. Es el mismo fallo que ya se cazó en el admin.
- **El mensaje de error del build se probó de verdad**, apagando la API: dice el endpoint y qué
  mirar. Sin eso, «build failed» obliga a ir servicio por servicio.
- ⚠ **`whatsappNumber` es OPCIONAL en el DTO, y nadie lo comprobaba.** Lo cazó `astro check`, no
  el build: James puede vaciarlo desde el panel, y **una landing sin número de WhatsApp es una
  landing sin negocio** — el clic ES el lead, así que sin número no hay ninguna conversión
  posible. Ahora el build **aborta** y el mensaje dice dónde rellenarlo: Configuración →
  Contacto y redes. Publicar así sería peor que no publicar.
  `tagline` sí cae al nombre de la marca: eso tiene respaldo razonable.
- **`astro check` ve lo que el build no.** El build compiló con `string | null` donde se esperaba
  `string`; el chequeo de tipos lo paró. Va en el CI antes que el build.

---

## Task 3 · Secciones de contenido · una por una contra su artboard

- [x] **T3.1** **Barra**. En móvil: tira de contexto (Ayacucho · horario) + barra con marca,
      botón verde y hamburguesa + tira de píldoras. En escritorio: dos alturas, y el activo con
      **`box-shadow: inset`**, nunca un `border` — un borde de 2px solo en el activo empuja el
      resto al navegar.
- [x] **T3.2** **Confianza**: 30 eventos · 24 h · 7 reels. Los tres salen de datos reales; el que
      no tenga dato **no se pinta**.
- [x] **T3.3** **Tira de reels** («lo último que entregué»), deslizándose sola. `translateX`
      infinito, y **se para con `prefers-reduced-motion`**.
- [x] **T3.4** **Cómo funciona**, tres pasos. Es la sección que quita el miedo: dice qué pasa
      DESPUÉS de escribir, que es la incertidumbre real de quien paga por adelantado.
- [x] **T3.5** **Diferenciadores** con sus iconos de la lista cerrada y `?? 'link'` de reserva.
- [x] **T3.6** **Qué recibes** — 7 reels · 1 aftermovie · material bruto · **por enlace en 24 h**.
      Se paga por un archivo que no existe todavía; esto lo convierte en una cosa.
- [x] **T3.7** **Categorías**. Solo las `isActive`, en su `order`, **cada una con su URL propia**
      (`/bodas`, `/xv-anos`…): son las cuatro búsquedas reales del negocio y la puerta de entrada
      desde Google. En escritorio, cuatro en fila.
- [x] **T3.8** **Paquetes** — `repeat(auto-fit, minmax(240px, 1fr))`, **nunca `grid-cols-3`**.
      Un solo destacado, con su `packageId` en el botón. Encima, la tira **«En los tres,
      siempre»**, que mata el miedo a elegir el barato y quedarse sin algo.
      Precios con `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })`.
      **El acento único sube**: Básico neutro → Pro latón (y el único con botón verde) →
      Premium hueso. En claro el hueso se invierte al negro cálido: sobre blanco es invisible.
- [x] **T3.9** **Calendario**: se maqueta la sección con su `id`, la lógica es de la fase
      posterior. Días a **48px**.

      **Lo que salió construyéndolo.** El escritorio va **texto a la izquierda, calendario a
      la derecha en 480px**, no al revés: con la rejilla primero la sección se lee como un
      formulario, y lo que hay que entender antes de tocar un día es que tocarlo escribe el
      mensaje. La rejilla se queda en **42 celdas siempre** aunque el mes quepa en cinco
      filas: una altura fija es lo que evita el salto al pasar de mes. Y `scroll-padding-top`
      subió de 88px a **190/128**: la cabecera son tres filas y mide 177px en móvil, así que
      cada clic del menú dejaba el antetítulo debajo de la barra.
- [x] **T3.10** **Testimonios** — solo `isActive` **y `hasConsent`**, con test de que no llega
      ninguno sin permiso (Ley 29733, y hay menores en los XV).
      **La captura de WhatsApp SE VE**: es la única prueba que no se puede inventar y James ya la
      sube (`format: SCREENSHOT`). Recortada con degradado y su línea de permiso debajo.
      Las estrellas solo si hay `rating`: cinco apagadas dicen «valorado con cero».
- [x] **T3.11** **Preguntas** — las cuatro que frenan: viajar, cuándo se paga, si llueve, si se
      pueden pedir cambios. Van en `copy.ts`.
- [x] **T3.12** **Sobre mí** — `aboutText` en Markdown, **solo negrita**, renderizado en build.
      **Con su foto y su apellido**: esta persona va a estar diez horas dentro de la boda de tu
      hija. Ver «Lo que hay que pedirle a James».
- [x] **T3.13** **Cierre y pie**. El cierre es un **panel** con margen y esquinas, que declara su
      color. El pie con redes, la firma SVG y los enlaces legales.
- [x] **T3.14** **Barra pegada** en móvil: `sticky bottom-0`, **aparece al pasar el hero**. Antes
      no: arriba el CTA ya está a la vista y duplicarlo es ruido.
- [x] **T3.15** **Estado vacío de cada sección: si no hay contenido, NO se pinta.** Un titular
      con nada debajo se lee como un fallo de carga.

---

## Task 4 · Galerías

- [x] **T4.1** Índice con la rejilla, filtrable por categoría. **`GET /galleries` NO trae los
      medios**, solo portada y `mediaCount` — si los trajera, el build se descargaría todos los
      reels de todos los eventos en una respuesta que crece sin techo.
- [x] **T4.2** `[slug].astro` con `getStaticPaths`. El detalle sí trae los medios.
- [x] **T4.3** **Sin autoplay en la rejilla.** Miniatura + póster; el vídeo se carga al abrir.
- [x] **T4.4** Visor a pantalla completa con `<dialog>` nativo —foco atrapado, Escape y
      `::backdrop` gratis— y **48 px** en cada control.
- [x] **T4.5** Solo medios `status: READY`. Los demás no existen para la web.
- [x] **T4.6** Una portada que no carga **se esconde y deja ver el degradado**, y **avisa por
      consola**. Sin el `onerror`, un fallo de red parece un fallo de datos; sin el aviso, un
      bucket mal configurado se ve igual que una galería vacía.

      **Lo que salió construyéndolo.**
      · **`[hidden]` NO gana por sí solo.** La regla vive en la hoja del navegador, así que
        cualquier `display: flex` de Tailwind en el mismo elemento la pisa: `el.hidden = true`
        dejaba la tarjeta a la vista **sin que nada fallara**. Hay un `[hidden] { display: none
        !important }` en `global.css`, y lo necesitan el filtro de trabajos y la fecha elegida
        del calendario.
      · **La barra pegada esperaba un hero que en una galería no existe**, así que fuera de la
        portada no aparecía nunca. El hero se marca con `data-hero` y sin él la barra se
        enseña desde el principio, en vez de adivinarlo con `main > section`.
      · **Una foto era una tesela muerta**: iba `disabled` y se veía idéntica a las demás. El
        visor abre `<img>` o `<video>` según `data-tipo`.
      · **El menú fuera de la portada apuntaba al vacío.** `Barra` recibe un `prefijo`, así que
        `#paquetes` es `/#paquetes` desde una galería y la lista sigue siendo una sola.
      · Los chips de categoría salen de **las galerías que hay**, no del catálogo: un filtro
        que deja la rejilla vacía es una promesa rota.

---

## Task 5 · El clic a WhatsApp

Es el único número que mide este proyecto. Tiene su propio task por eso.

- [x] **T5.1** **Un solo constructor de mensajes** (`lib/whatsapp.ts`) para el hero, los paquetes,
      el pie y —después— el calendario. Con cuatro sitios construyendo la cadena, en dos semanas
      dicen cosas distintas.
- [x] **T5.2** **El texto base sale de la BASE, no del código**: `paquete.whatsappMessage ??
      settings.whatsappMessage`. El código solo compone el contexto. **El admin ya PROMETE esa
      igualdad** — `campo-whatsapp.tsx` mete ese mismo texto en su botón de «Probar este número»
      para que James vea lo que va a pasar. Si la web compone el suyo, ese botón pasa a mentir.
- [x] **T5.3** **`fetch(..., { keepalive: true })`** para registrar el clic. Sin eso, la petición
      **muere en la navegación a `wa.me`** — y es justo el clic que hay que contar.
- [x] **T5.4** ⚠ **Requiere el CORS del Task 1 del plan del calendario.** Hoy la API **no tiene
      `enableCors`**, así que ese `POST` fallaría en el preflight y **el clic no se registraría**,
      en silencio. Si esta fase se hace antes, ese task viene con ella.
- [x] **T5.5** `source` por superficie (`hero`, `paquetes`, `footer`, `galeria`). **Es una lista
      cerrada con `@IsIn`**: cualquier valor nuevo hay que añadirlo a `FUENTES` en
      `track-click.dto.ts` **y regenerar el snapshot del OpenAPI**, o el clic da 422 y se pierde
      sin ruido.
- [x] **T5.6** **El fallo del tracking NUNCA rompe el enlace.** Se registra y se navega; si el
      registro falla, se navega igual. Perder una métrica es barato, perder el lead no.
- [x] **T5.7** La pista bajo el botón: «Se abre tu WhatsApp con el mensaje ya escrito.»

**Lo que salió construyéndolo.**
· **El CORS del Task 1 del calendario se hizo aquí**, como el propio T5.4 avisaba. Cinco tests
  de integración, y comprobado que fallan sin él.
· **`source` pasó a ser una unión cerrada en `packages/contracts`.** Era `string`, y la web ya
  estaba emitiendo `calendario-libre` —que no existía en `FUENTES`— compilando tan feliz: 422 y
  clic perdido sin ruido. Al arreglarlo, **la API dejó de compilar** con su `source?: string`,
  que es exactamente lo que tenía que pasar.
· El registro va **delegado en `document`** desde el `Layout`, no un listener por botón: son
  seis CTA en la portada más uno por paquete, y con uno por componente el siguiente se olvida.
· Verificado en Chromium con la API viva: hero, paquetes (con su `packageId`) y
  `calendario-libre` llegan; una fuente inventada da 422.

---

## Task 6 · Animaciones, midiendo ✅

**El orden es el de §6 y no se salta**: la métrica se mide entre paso y paso, no al final.

- [x] **T6.1** Landing **sin animaciones**. Medir. Ésa es la línea base.
- [x] **T6.2** ~~+ GSAP y ScrollTrigger~~ → **`IntersectionObserver`, y GSAP NO entra.**
- [x] **T6.3** ~~+ Lenis~~ → **Lenis NO entra.**
- [x] **T6.4** Si el INP pasa de 200 ms, se quita en orden inverso. No hizo falta: no se añadió
      nada que quitar.
- [x] **T6.5** Con el movimiento reducido la web **funciona igual**, solo que quieta. Verificado:
      0 animaciones corriendo y **0 bloques escondidos**.
- [x] **T6.6** Techo de seis pasos en la cascada (`min(var(--i), 6)`), como en el admin.

### Lo que la medición encontró

El problema real no era la falta de librería: **27 de los 35 bloques con `.entra` estaban debajo
del pliegue y terminaban su entrada antes de que nadie llegara a verlos**. La animación se
gastaba en vano y, peor, toda la página de abajo aparecía quieta.

Eso lo resuelve un **`IntersectionObserver` de diez líneas**. GSAP + ScrollTrigger harían lo
mismo por ~50 KB moviendo el trabajo al hilo principal, que es justo lo que el presupuesto de
INP existe para proteger — y es el mismo argumento por el que `motion` se quitó del admin.

**Lenis tampoco entra.** `scroll-behavior: smooth` ya es nativo y ya está puesto dentro de
`prefers-reduced-motion`. Lenis secuestra la rueda y deja un bucle de `requestAnimationFrame`
corriendo para siempre en el hilo principal: es el mayor riesgo de INP de toda la lista, a
cambio de nada medible en una página cuyo único trabajo es un clic a WhatsApp.

**Cómo se esconde sin poder dejar nada invisible:** `:root.js .entra { opacity: 0 }`. La clase
`js` la pone el mismo script bloqueante del tema, así que **sin JS nunca se esconde nada**. Y con
movimiento reducido el observador ni se monta: se marca todo visible de una vez.

### Números, con la CPU frenada 4× (Chromium, 390 px)

| Página | LCP | CLS | INP |
|---|---|---|---|
| `/` | 304 ms | 0.015 | 80 ms |
| `/trabajos` | 140 ms | 0.001 | 32 ms |
| `/trabajos/[slug]` | 152 ms | 0.001 | 48 ms |
| Legales | 124 ms | 0.001 | — (nada pulsable que se quede) |

Presupuesto: LCP <2.5 s · INP <200 ms · CLS <0.1. **Los tres, con margen.** Ojo: es `localhost`,
así que el LCP real subirá con la red; lo que estos números miden es el trabajo de render, que
es lo que está en nuestra mano.

### Tres trampas de la medición, que costaron más que el cambio

Las tres daban números que decían lo contrario de la verdad:

1. **Encadenar clics cada 300 ms mide la cola de la acción anterior**, no la interacción. Daba
   336 ms en la página de legales, que no tiene ni una animación.
2. **Un evento que navega a otra página registra ~980 ms**: su «presentación» abarca la carga
   del documento nuevo. En las páginas internas el menú enlaza a `/#paquetes`, así que el
   clic se iba de la página. Eso no es la respuesta de la interfaz a un toque.
3. **Un clic forzado en el centro de un contenedor cae sobre un hijo.** El guardia que
   excluía los enlaces miraba el contenedor, no lo que recibía el clic de verdad.

Y una cuarta, descartada tras comprobarla: un Chromium headless quieto tarda en producir
fotograma, así que la medición lleva un pulso de `requestAnimationFrame` que **cambia un píxel**
—uno que no pinta nada no produce fotograma presentado—. Con eso, la portada bajó de 72 a 32 ms
de forma reproducible.

**Los scripts de medición NO se commitean**: son de usar y tirar, y lo que hay que conservar es
el método de arriba con sus trampas. Se rehacen en veinte líneas cuando toque volver a medir.

---

## Task 7 · SEO, compartir y legales

- [x] **T7.1** `metaTitle` y `metaDescription` desde `SiteSettings`. Canónica en cada página.
- [~] **T7.2** **OG por galería**, 1200×630 desde una portada 9:16. Escrita (`og()` en
      `lib/imagen.ts`) y aplicada a las páginas de trabajo. ⚠ **FALTA VERIFICARLA CON UNA FOTO
      REAL**: en local las portadas las sirve MinIO, que **no transforma** —se ignoran los
      parámetros y sale la vertical entera—, así que el recorte solo se puede comprobar contra
      Cloudflare. Una OG que decapita a la novia es peor que ninguna, y se ve en cada WhatsApp
      que comparta el enlace.
- [x] **T7.3** JSON-LD `LocalBusiness` con la dirección, el teléfono y el horario. Es lo que
      alimenta el panel de Google.
- [x] **T7.4** `sitemap` (la integración ya está) y `robots.txt`.
- [x] **T7.5** **Páginas legales: privacidad, términos y consentimiento de imagen.** Ley 29733.
      `CLAUDE.md` lo dice sin rodeos: **es el único punto que puede traerle un problema real a
      James**, y hay menores en los XV. **No es opcional y no se deja para la fase 6.**
- [x] **T7.6** `_headers` de Cloudflare Pages: CSP, `X-Content-Type-Options`, `Referrer-Policy`,
      `Permissions-Policy`. **La CSP tiene que permitir el dominio `media.` y el de la API**, o la
      web se queda sin imágenes y sin tracking y el error solo se ve en consola.

**Lo que salió construyéndolo.**
· **`unsafe-inline` en `script-src` no es un descuido**: el script del tema va en línea y
  bloqueante A PROPÓSITO, y con nonces habría que generar el HTML en runtime. Esta web es
  estática.
· **Los dominios de la CSP están a mano y `CDN_BASE_URL` es otra fuente de verdad.** Si
  divergen, la web se queda sin imágenes y solo se ve en la consola del visitante. Hay que
  revisarlo al conectar el dominio.
· **El JSON-LD NO lleva `address`**, y es deliberado: James no ha dado dirección fiscal y no
  graba en un local. Va `areaServed: Ayacucho`, que es cierto. Un dato inventado en lo único
  que Google lee sin revisión es peor que un esquema incompleto.
· **Los legales no inventan RUC, razón social ni correo.** El canal es el WhatsApp que ya
  vive en la base. ⚠ **Los tiene que leer un abogado antes de publicar**: son un texto
  honesto sobre lo que la web hace, no un dictamen.
· Las tres páginas salen de un `[legal].astro` con `getStaticPaths` sobre `content/legal.ts`:
  comparten maqueta exacta, y en tres ficheros una se quedaría atrás.
· **La barra pegada NO va en los legales.** Un botón verde persiguiendo a quien lee por qué
  puede pedir que le quiten una foto es el momento exacto de no vender.

---

## Task 8 · Responsive, accesibilidad y cierre ✅

- [x] **T8.1** La matriz entera, como en el admin: nueve anchos, zoom al 200 %, móvil horizontal,
      **y el test que nombra el elemento que desborda**. Sin eso el fallo dice «desborda» y hay
      que ir componente por componente.
- [x] **T8.1b** **El test que hace cumplir la regla del fondo oscuro.** Recorre el DOM y falla
      si un elemento con fondo oscuro no declara su color de texto — el fallo que se coló cuatro
      veces en los prototipos y que solo se veía a ojo. En el canvas lo caza `derivar-claro.mjs`;
      aquí lo tiene que cazar Playwright, en los dos temas.
- [x] **T8.2** **Contraste medido sobre el fondo real, capa a capa, EN LOS DOS TEMAS** — el mismo
      test que cazó los tres fallos del tema claro del admin. Aquí el listón es más alto que AA:
      sol, pantalla barata, cincuenta años.
- [x] **T8.3** **Objetivos táctiles de 48 px**, no 44. Medido, y con las animaciones acabadas: un
      botón bajo `scale(0.97)` mide menos y el test falla por algo que no es un fallo.
- [x] **T8.4** Navegación con teclado de punta a punta, foco visible, `skip link`.
- [x] **T8.5** **Sin JavaScript, la web sigue sirviendo**: se lee, se ven las galerías y **los
      botones de WhatsApp funcionan**. Son `<a href>`, no botones con listener.
- [x] **T8.6** Playwright contra el build real: el hero carga, un paquete lleva a `wa.me` con el
      mensaje correcto, una galería abre su visor. **Y ningún enlace interno da 404**, que es lo
      que faltaba: 60 tests.
- [~] **T8.7** ~~Lighthouse~~ y **CrUX**. Las tres métricas se miden en el Task 6 con la CPU
      frenada 4× —LCP 304 ms · CLS 0.015 · INP 80 ms—, con margen sobre el presupuesto. **CrUX
      necesita tráfico real**: no se puede cerrar hasta que la web esté publicada y visitada.
- [x] **T8.8** `CLAUDE.md`: lo aprendido, la base de 17 px y los 48 px, y por qué la landing lleva
      una librería de calendario distinta a la del admin.
- [x] **T8.9** `pnpm outdated` y `pnpm audit`. **Cero vulnerabilidades**, tras forzar dos:
      `qs` (>=6.16.0), que SÍ está en el camino de una petición —parsea la query string de
      Express, y los controllers públicos los llama cualquiera—, y `mysql2` (>=3.23.1), que
      llega por el CLI de Prisma y aquí no se carga nunca —es PostgreSQL con `PrismaPg`—
      pero acaba en el árbol de `pnpm deploy --prod` igual. `outdated` solo lista parches
      menores; nada deprecado.

### La suite: `apps/web/e2e`, 56 tests contra el BUILD

Playwright propio, no colgado del admin: aquel apunta al 3001 y arranca con sesión. Se prueba
`dist/` servido por `astro preview`, **nunca `astro dev`** — lo que se despliega es el build, y
el dev transforma al vuelo con otro pipeline.

**El que más caro salía, y que ninguno de los 56 tests veía:** las **cinco tarjetas de
categoría de la portada enlazaban a `/bodas`, `/xv-anos`, `/cumpleanos`… y esas páginas no se
generaban**. Cada una era un 404. El `astro check` pasaba, el build pasaba y la suite entera
pasaba, porque nadie comparaba **lo que el build EMITE** con **lo que el build GENERA**. Ahora
existe `[categoria].astro` —que además es lo que quiere el SEO local: «videos de bodas en
Ayacucho» es literalmente lo que busca su cliente—, hay una `404.astro` propia con salida a
WhatsApp y a los trabajos, y `e2e/enlaces.spec.ts` recorre los enlaces internos de cinco
páginas semilla y pide un 200 de cada uno. La portada, además, solo pinta la tarjeta de una
categoría **que tenga trabajos**: sin ellos no hay página que enseñar.

**Cinco fallos más:**

1. **El `<h1>` estaba DUPLICADO.** El hero de móvil y el de escritorio eran bloques distintos
   con el mismo titular, cada uno oculto en el ancho del otro: a ojo nunca se veían los dos,
   pero el documento llevaba dos `<h1>`. Fusionados en uno con clases `lg:`.
2. **Las portadas de categoría, negro sobre negro en claro** (1.00:1). El cuarto sitio donde se
   cuela el mismo fallo: un fondo oscuro que HEREDA su color de texto.
3. **El latón de leer daba 4.30:1 sobre `surface`**, por debajo de AA — y ahí viven todos los
   antetítulos. La nota de la paleta decía 4.9 porque estaba medida solo contra `ground`.
   Bajado de `#8a6d3b` a `#806436`.
4. **Los días del calendario medían 42 px de ancho** a 390 px: los 48 de alto nunca estuvieron
   en duda, pero el ancho lo reparte una rejilla de siete columnas y ahí es donde se pierde.
5. **Los chips de categoría iban a `h-11`** (44 px) cuando el listón de este proyecto es 48.

**Y cuatro trampas del propio test**, que daban rojo sin que hubiera nada roto:

· **Sacar los colores con una expresión regular está MAL.** Tailwind 4 sirve `bg-void/90` como
  `oklab(0.985 -0.00005 0.004 / 0.9)`, y leerlo como RGB 0-255 da casi negro: el test acusaba
  a la barra del pie de 1.04:1 cuando es blanca. Ahora se pinta el color sobre blanco y sobre
  negro en un canvas y se despeja — exacto para cualquier sintaxis. ⚠ **El test del admin
  tiene el mismo fallo y hay que arreglarlo ahí.**
· **`background-color` no ve un degradado.** El panel de cierre pinta su oscuro con
  `linear-gradient`, que es una `background-image`: el test lo saltaba y creía ver el blanco
  del `body`. Ahora se extraen las paradas del degradado y manda **la peor**.
· **Lo que un ancestro RECORTA no desborda la página.** El aura del hero mide 720 px dentro de
  su `overflow-hidden`, y el test la acusaba mientras el scroll real estaba en cero — que era
  la señal de que el equivocado era el test.
· **`astro preview` de Astro 7 DAEMONIZA y vuelve.** Playwright lo lee como «el servidor murió
  al empezar» y el error no menciona ni a Astro ni al puerto. El comando termina en un proceso
  de espera. Y si se cuelga se para con `astro preview stop`, **no** matando el pid: eso deja
  el registro del demonio y el siguiente arranque se niega.

---

## Lo que hay que pedirle a James

**Antes de maquetar «Sobre mí» y los paquetes**, porque son huecos que el diseño ya reserva:

- [ ] **Su foto**, de cara y decente. Hoy hay un marcador. Sin ella la sección podría ser de
      cualquiera, y es la persona que va a estar diez horas dentro de la boda de una hija.
- [ ] **Su apellido.** En el prototipo está como `[APELLIDO]`.
- [ ] **Su logo y su firma en SVG.** Hoy están dibujados a mano en los artboards.
- [ ] ⚠ **El Pro incluye «Mini-Reel exprés (Same Day / 12h)» y el Premium NO.** Verificado en
      `apps/api/prisma/seed.ts:63`. Quien compare de arriba abajo ve que el caro tiene **menos**,
      y eso no es una duda: es un motivo para no pagar los 300 soles de diferencia.
      **¿El Premium lo hereda, o es a propósito?** No se toca la copia hasta que conteste.
- [ ] ⚠ **Los mismos 7 reels se llaman «en tendencia» en el Básico y «Virales» en Pro y
      Premium.** Insinúa que los del barato son peores, y contradice la tira «En los tres,
      siempre · 7 reels». Es su copia, no la nuestra: decide él.
- [ ] **La dirección exacta y el horario**, para los datos estructurados de negocio local. **Sin
      inventarlos**: un `LocalBusiness` con una dirección falsa es peor que ninguno.
- [ ] **Los recuentos de verdad**: eventos grabados, reels entregados. En el prototipo son 30 y 7
      como marcadores. Si no hay dato, la línea no se pinta.

---

## Orden y coste

| | Qué | Coste |
|---|---|---|
| 0 | **Diseño y prototipos** | ✅ hecho |
| 1 | Cimientos | ~1 día |
| 2 | Hero | ~0,5 día |
| 3 | Secciones de contenido | ~1,5 días |
| 4 | Galerías | ~1 día |
| 5 | El clic a WhatsApp | ~0,5 día |
| 6 | Animaciones midiendo | ~1 día |
| 7 | SEO, compartir y legales | ~1 día |
| 8 | Responsive, a11y y cierre | ~1 día |

**~7,5 días** con el Task 0 ya cerrado. Y ese día y medio no se ahorró: se gastó, y a cambio
sacó cuatro fallos que habrían llegado al código —texto negro sobre negro en cuatro sitios, el
CTA por debajo del pliegue, cinco estrellas que afirmaban una nota que nadie dio, y objetivos
táctiles por debajo de la regla del propio plan— más dos incoherencias del catálogo de James.

**Dependencia externa que hay que resolver antes del Task 5**: el CORS de la API (Task 1 del plan
del calendario). Es medio día y sin él la única métrica del negocio nace a cero.

---

## Después de esta fase

Fase 6 (cierre): el **deploy automático**, que hoy no existe —`TriggerDeployInterceptor` es un
comentario— y sin el cual publicar un cambio del admin exige un build a mano. Después, el
**calendario**, que necesita las dos.
