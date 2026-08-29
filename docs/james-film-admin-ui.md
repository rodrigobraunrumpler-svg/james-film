# James Film — UI del panel de administración

> Guía de diseño e implementación del admin.
> Complementa `james-film-proyecto.md`, que cubre arquitectura, datos y operación.
> Última actualización: 30 de agosto de 2026

---

## 1. Principio

**El admin es una herramienta, no una vitrina.**

Lo que hace que alguien disfrute usando un panel no es el espectáculo: es que nunca le haga esperar ni dudar. James abre, ve su trabajo, hace lo que venía a hacer en veinte segundos y se va contento.

Hay un beneficio de negocio detrás: si el admin es agradable, **James publica más seguido**, y una web que se actualiza vende más que una congelada.

> **Un producto real no es el que tiene más funciones, es el que no falla en las que tiene.** Un admin de 8 pantallas donde todo responde al instante, nada se pierde y los errores se explican bien se siente más profesional que uno de 40 pantallas a medias.

---

## 2. Base técnica

**shadcn/ui directamente, no un template completo.**

Los templates del mercado están sobredimensionados: Apex Dashboard trae 216 páginas y 12 variantes (Overview, Analytics, CRM, Finance, HR, Logistics…). James necesita 8 pantallas. Adoptar 216 páginas para usar 8 no es una ventaja: son 208 páginas de código muerto y dependencias que no sabes si algo usa.

shadcn no es una librería que instalas: son componentes que copias a tu repo y te pertenecen.

```bash
npx shadcn@latest init
npx shadcn@latest add sidebar table form dialog badge sonner command skeleton
pnpm add @tanstack/react-table @dnd-kit/core react-hook-form zod cmdk
```

| Paquete | Para qué |
|---|---|
| `@tanstack/react-table` | Tablas con orden y filtro sin escribirlo tú |
| `@dnd-kit/core` | Drag & drop **con soporte táctil** (ver §7) |
| `react-hook-form` + `zod` | Formularios; el mismo esquema Zod se reutiliza en el DTO |
| `cmdk` | Paleta de comandos ⌘K |
| `sonner` | Toasts |

**Sin Recharts.** El dashboard no lleva gráficos: con cinco eventos al mes, cualquier gráfico son cuatro puntos y una línea que no dice nada.

### Referencias visuales

Para calibrar el listón: **Linear, el dashboard de Vercel, Stripe y Raycast.** Ninguno es descargable, pero es el estándar contra el que la gente compara.

Lo que tienen en común y sí se copia: densidad alta sin agobio, una sola familia de acento, tipografía pequeña pero legible, y transiciones cortas.

### Starters como referencia, no para clonar

- **next-shadcn-dashboard-starter** (Kiranism) — 5.9k estrellas, commits semanales, Next.js 16
- **next-shadcn-admin-dashboard** (arhamkhnz) — MIT, template oficial de Vercel, arquitectura *colocation-first* que encaja con la separación por módulos del proyecto

Míralos para ver cómo resuelven sidebar, data table y formularios. No los instales.

---

## 3. Paleta

**El admin usa los mismos tokens que la landing, con escalones intermedios.**

shadcn se configura por variables CSS, así que enchufar la marca es cambiar valores, no reescribir componentes. El resultado no parece un template: James abre el admin y ve su marca, no un panel genérico azul.

| Token | Hex | Uso |
|---|---|---|
| `content` | `#0F0D0C` | Fondo del área de trabajo |
| `chrome` | `#151311` | Sidebar y barras — **más claro que el contenido** |
| `card` | `#171412` | Tarjetas y superficies |
| `card-hover` | `#1C1917` | Hover de nav y botones |
| `active` | `#221E1A` | Item de nav activo |
| `well` | `#080706` | Miniaturas de video |
| `line` | `#262220` | Bordes normales |
| `line-strong` | `#3D362F` | Bordes de botones y foco |
| `line-hover` | `#4A4038` | Borde de tarjeta en hover |
| `muted` | `#5F5952` | Metadatos, placeholders |
| `ash` | `#8E877E` | Texto secundario |
| `bone` | `#F2EFE9` | Texto principal |
| `brass` | `#C9A96A` | **Acento único** |

### Tres decisiones

**El sidebar es más claro que el contenido, no más oscuro.** Al revés hace un agujero negro a la izquierda en vez de jerarquía. El chrome se separa del área de trabajo subiendo, no bajando.

**Los grises necesitan escalones intermedios.** Saltar de `#0F0D0C` a `#F2EFE9` sin nada en medio se ve duro y plano. La gradación `#0F0D0C → #151311 → #171412 → #262220 → #3D362F` es la diferencia entre plano y con profundidad.

**Nada de botones dorados macizos.** El acento va en bordes, iconos y el item activo. Un botón de latón sólido grita más que el contenido, que es justo lo contrario de lo que debe pasar en un admin.

### Por qué oscuro

No es solo coherencia con la landing. **El admin está lleno de miniaturas de video.** Sobre fondo oscuro los posters resaltan, igual que en la landing. Un admin blanco con miniaturas encima las aplana.

---

## 4. Tipografía y densidad

**Texto pequeño, espaciado generoso.** Al revés de lo intuitivo, y es lo que más distingue una herramienta seria de una de juguete.

| Elemento | Tamaño |
|---|---|
| Título de página | 17px / 600 |
| Cuerpo y filas | **13px** |
| Metadatos y etiquetas | 11-12px |
| Nav del sidebar | 13px |
| Logo del sidebar | 11px, `letter-spacing: 0.2em` |

**Altura de fila 36-40px, no 56.** Un admin con texto a 16px y filas de 56px se siente inflado. Linear y Stripe usan 13px.

Fuente: **Inter**. La landing usa Bricolage Grotesque para display, pero un admin no tiene titulares expresivos — necesita legibilidad a 13px, y ahí Inter gana.

---

## 5. Layout: tarjetas, no tablas

**La decisión más importante de todo el admin.**

Una tabla de texto es la UI correcta para datos. Las galerías de James son **contenido visual**: las reconoce por la imagen, no leyendo "XV de Camila".

```
┌──────────┬─────────────────────────────────────┐
│          │ ● 3 cambios sin publicar  [Publicar]│
│  SIDEBAR ├─────────────────────────────────────┤
│          │ [Buscar…        ⌘K]        [+ Nueva]│
│  Galerías├─────────────────────────────────────┤
│  Panel   │ Todas 14 · Publicadas 11 · Borr. 3  │
│  Categ.  │                                     │
│  Paquetes│ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│  Testim. │ │ ▶  │ │ ▶  │ │ ▶  │ │░░░░│         │
│  Ajustes │ └────┘ └────┘ └────┘ └────┘         │
│          │  card   card   card  skeleton       │
│ ─────────│                                     │
│ Espacio  │              ┌──────────────────┐   │
│ 3.2/10GB │              │ ✓ Despublicada   │   │
│ ▓▓▓░░░░░ │              │       [Deshacer] │   │
│ (J) James│              └──────────────────┘   │
└──────────┴─────────────────────────────────────┘
```

### Detalles del layout

**El medidor de espacio va en el sidebar, no en el dashboard.** Ahí lo ve siempre, no solo cuando entra al panel. Es información de estado, y el estado va en el chrome.

### Proporciones de miniatura

**La miniatura es un identificador, no una previsualización fiel.** Solo tiene que dejar reconocer cuál es cuál. Respetar el 9:16 del archivo alarga la pantalla muchísimo y hace que quepan la mitad de elementos.

| Contexto | Proporción | Por qué |
|---|---|---|
| Tarjeta de galería | **16:10** | Es la portada del evento, se lee como escena |
| Grilla de medios y subida | **3:4** | Se lee vertical sin estirar; caben el doble por columna |
| Reproductor | **9:16 real** | Aquí sí importa ver el encuadre completo |

**No uses 4:3**: a esa altura ya no distingues un reel de un aftermovie de un vistazo.

```css
.thumb {
  aspect-ratio: 3 / 4;
  object-fit: cover;          /* recorta arriba y abajo, no deforma */
  object-position: center 35%;
}
```

**El `35%` en vez de `center` importa en este caso concreto: en un reel la cara suele estar en el tercio superior**, no en el centro geométrico. Recortando desde ahí conservas rostros en vez de torsos.

El archivo no se toca — todo es `object-fit`.

**Badges sobre la miniatura**: contador de medios arriba a la derecha, duración abajo a la derecha, estado "Borrador" arriba a la izquierda. Fondo `rgba(8,7,6,.82)` para que se lean sobre cualquier frame.

**Filtros como tabs con contadores**, no un dropdown. `Todas 14 · Publicadas 11 · Borradores 3`. Se ve el estado del catálogo sin hacer clic.

### Grilla responsive

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
```

Nunca `grid-cols-4` fijo. Con `auto-fit` la grilla se acomoda sola de móvil a escritorio.

---

## 6. Sistema de animación

**Las animaciones del admin son lo contrario a las de la landing.** Allí 600ms y reveals expresivos están bien. En una herramienta, cualquier cosa por encima de 200ms se siente como lentitud, no como elegancia.

| Interacción | Duración | Curva |
|---|---|---|
| Hover de botón o nav | 120ms | `ease` |
| Elevación de tarjeta | 150ms | `cubic-bezier(.4,0,.2,1)` |
| Zoom de miniatura | 250ms | `cubic-bezier(.4,0,.2,1)` |
| Entrada de grilla | 350ms, stagger 60ms | `cubic-bezier(.2,.8,.2,1)` |
| Cambio de vista | 200ms | View Transitions API |
| Toast | 200ms entrada / 150ms salida | `ease-out` |

**Nada por encima de 350ms.**

**El stagger se corta a las primeras 8 tarjetas.** Si escalonas 40 elementos, la última entra dos segundos tarde y eso ya es lentitud, no elegancia.

```css
.card {
  animation: up .35s cubic-bezier(.2,.8,.2,1) both;
  transition: transform .15s cubic-bezier(.4,0,.2,1), border-color .15s ease;
}
.card:hover { transform: translateY(-3px); border-color: #4A4038; }
.card:hover .thumb { transform: scale(1.05); }

@keyframes up { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
```

**Solo `transform` y `opacity`.** Igual que en la landing: animar `top`, `left` o `width` fuerza reflow y hunde el INP.

Y respeta `prefers-reduced-motion` — el mismo `gsap.matchMedia()` o una media query CSS.

---

## 7. La función que lo cambia todo

**Al pasar el cursor sobre una tarjeta, el reel se reproduce.** Silenciado, en bucle, dentro de la miniatura.

```tsx
const [preview, setPreview] = useState(false);
const timer = useRef<number>();

onMouseEnter={() => { timer.current = window.setTimeout(() => setPreview(true), 400); }}
onMouseLeave={() => { clearTimeout(timer.current); setPreview(false); }}
```

**El retardo de 400ms no es opcional**: sin él, mover el ratón por la grilla dispara diez videos a la vez.

Es la función con más impacto de todo el admin. Recorrer la grilla se convierte en ver su propio trabajo pasar — no es adorno, es la razón por la que se quedaría mirando.

**En móvil no aplica.** No hay hover: la miniatura estática es lo correcto.

> Se combina con el **scrub en hover** de §8: autoplay si el cursor está quieto 400ms, scrub si se mueve horizontalmente.

---

## 8. El flujo de subida

**Es la interacción central del admin.** Todo lo demás es CRUD; esto es lo que James hace de verdad.

### Los estados de una tarjeta

| Estado | Visual |
|---|---|
| **Subiendo** | El latón sube desde abajo llenando la miniatura, con el % centrado |
| **Procesando** | Shimmer sobre la miniatura + "Procesando…" |
| **Listo** | Check en círculo de latón arriba a la izquierda, duración abajo |
| **Fallido** | Borde `#7A3B3B`, fondo teñido, motivo y botón Reintentar |
| **Zona de arrastre** | Borde discontinuo en latón con pulso lento de 2s |

**El llenado de la miniatura es la decisión clave.** El objeto que está trabajando *es* el indicador, no una barra separada. Ves el reel llenarse.

```css
.fill {
  position: absolute; left: 0; right: 0; bottom: 0;
  background: rgba(201,169,106,.16);
  border-top: 1px solid #C9A96A;
  height: var(--progreso);   /* 0% → 100% */
  transition: height .2s linear;
}
```

### Barra de lote

Arriba del contenido, fija mientras haya subidas:

```
Subiendo 5 de 8 · quedan ~2 min                    [Cancelar]
▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░
```

**La estimación se calcula con la velocidad real medida**, no dividiendo el tamaño total. Una estimación que salta de 8 min a 30 s es peor que ninguna.

### La bandeja de subidas

Patrón de Google Drive, y es **la mejora funcional más grande de esta sección**:

```
┌────────────────────────────┐
│ ↑ 5 de 8 subidos        ⌄  │
│ Puedes seguir navegando.   │
│ Te aviso al terminar.      │
└────────────────────────────┘
```

Esquina inferior derecha, minimizable, **persistente entre pantallas**. James puede irse a editar precios mientras los ocho reels suben.

> **Que la subida no bloquee nada** es lo que separa un uploader de un producto. Ni la navegación, ni el guardado, ni cerrar el modal. Todo lo demás de esta sección es pulido encima de eso.

### Los errores dicen qué hacer

No qué pasó.

| Mal | Bien |
|---|---|
| "Formato no válido" | "Es 4K. Expórtalo a 1080p." |
| "Error de subida" | "Se cortó la conexión. Reintentar." |
| "Archivo demasiado grande" | "Pesa 340 MB. El límite es 200 MB — baja la calidad de exportación." |

Es el mismo trabajo escribirlo bien, y reduce las consultas a cero.

### Scrub en hover

Mover el cursor horizontalmente sobre la miniatura recorre el video:

```ts
onMouseMove={e => {
  const r = e.currentTarget.getBoundingClientRect();
  video.currentTime = video.duration * ((e.clientX - r.left) / r.width);
}}
```

**Es mejor que el autoplay en hover** para revisar: James encuentra un momento concreto en un segundo, sin abrir nada. Es lo que hacen Frame.io y Dropbox Replay.

Las dos se combinan: autoplay tras 400ms si el cursor está quieto, scrub si se mueve.

**En móvil no aplica** — no hay hover.

### Otras cuatro del flujo

**Barra de progreso superior en la navegación.** Dos píxeles de latón que avanzan al cambiar de vista (Linear, YouTube). Elimina la sensación de que nada pasó al hacer clic.

**Selección múltiple con barra que sube.** Patrón de Gmail y Drive: seleccionas tres reels y desde abajo aparece `3 seleccionados · Publicar · Mover · Eliminar`. Para reordenar un evento entero es la diferencia entre veinte clics y dos.

**Navegación con teclado en la grilla.** `j`/`k` moverse, `espacio` previsualizar, `x` seleccionar. Es lo que hace que Linear se sienta rápido, y son treinta líneas.

**Edición en línea.** Clic en el título y se edita ahí mismo, sin abrir formulario. Notion vive de esto.

### Advertencia de rendimiento

**Cada una de estas suma JavaScript y estado.** El scrub en hover con doce videos a la vez puede castigar un portátil modesto.

Constrúyelas de una en una y **prueba con la grilla llena de contenido real**, no con tres tarjetas de prueba.

---

## 9. Interacciones de producto

Lo que separa "un CRUD bonito" de un producto real.

### El estado se preserva

Volver a Galerías mantiene el filtro, el scroll y la búsqueda. **Guarda el estado en la URL**: `?estado=borrador&q=camila`. De paso los enlaces se pueden compartir.

Los CRUDs generados siempre devuelven al inicio. Es lo primero que delata un molde.

### Deshacer, no confirmar

En vez de un diálogo "¿seguro?", ejecuta y muestra un toast con **`Deshacer` durante 8 segundos**. Se siente rápido y protege más: los diálogos se aceptan sin leer.

**Excepción: borrar una galería mantiene confirmación fuerte.** Ahí hay archivos de R2 de por medio y no hay vuelta atrás. Que escriba el nombre de la galería, tipo GitHub.

### Fechas relativas siempre

Nada de "14 jun". **"Publicada hace 3 días"**, "Editada hace 2 horas", "Última consulta hace 2 horas".

La fecha absoluta obliga a calcular; la relativa se entiende sin pensar. Es el cambio más barato de la lista y el que más hace que los datos se sientan vivos.

Que se actualice sola: "hace 2 min" pasando a "hace 3 min" sin recargar.

### Optimistic updates

Marcar publicado cambia al instante y revierte si falla. Un spinner de 300ms en cada acción es lo que hace que un admin se sienta pesado.

### Skeletons, no spinners

El esqueleto **mantiene el layout exacto** de una tarjeta cargada. Cuando llegan los datos nada salta, la carga se percibe más corta, y de paso protege el CLS.

### ⌘K

Es lo que separa un panel de una herramienta. Escribir "Camila" y saltar a esa galería sin tocar el ratón es la función que hace que la gente diga que ama un software.

**Atajos:** `N` nueva galería · `/` buscar · `Esc` cerrar · `⌘S` guardar

### Vista previa embebida

En vez de "Ver en la web" abriendo otra pestaña, **un panel lateral con un iframe del sitio**. Cambia el título y lo ve reflejado sin cambiar de contexto.

Y un **modo previsualización de borradores**: la landing renderiza galerías no publicadas si viene con un token en la URL. Así ve el resultado final antes de publicar.

---

## 10. Las cinco pantallas que casi nadie hace

| Pantalla | Por qué se necesita |
|---|---|
| **404 dentro del admin** | James guarda un enlace, borras la galería, y ve un error del servidor |
| **Error boundary** | Un fallo de render deja la pantalla en blanco sin explicación |
| **Sin conexión** | Sube desde el celular en la calle y pierde señal — necesita saber que fue la red, no él |
| **Sesión expirada** | Modal para reautenticarse **sin perder lo escrito** |
| **Carga inicial** | El primer render mientras se valida el token |

**La de sesión expirada es la que más frustra si falta.** Escribe la descripción de una galería, expira el token, y pierde todo. Nunca hagas un redirect al login desde un formulario sucio.

### Estados vacíos con acción

La primera vez que entre no habrá nada. En vez de una grilla vacía: **"Aún no tienes galerías → Crear la primera"**. Es el momento en que decide si la herramienta le sirve.

Y el dashboard vacío se convierte en onboarding de tres pasos con checkmarks, no en tres ceros.

---

## 11. Detalles de cuidado

**Título de pestaña dinámico** — `XV de Camila · James Film`. Con varias pestañas abiertas, saber cuál es cuál.

**Aviso al salir con cambios sin guardar** — `beforeunload` cuando el formulario está sucio.

**Foco visible** — anillo en latón al navegar con teclado. Casi nadie lo hace y es lo que permite usar el admin sin ratón.

**Números que cuentan** — el contador de clics del dashboard subiendo de 0 a 47 en 600ms. Cuatro líneas de código.

~~**Autoguardado** — borrador con debounce de 2s.~~ **Descartado (Javier, 29-ago-2026).**
El editor guarda con un botón explícito, igual que Configuración. El autoguardado tenía sentido
mientras el editor era un borrador; con la galería publicada, cada campo está **en vivo en la
web**, y guardar a los dos segundos de escribir medio título es publicar medio título.
El aviso al salir con cambios sin guardar cubre el caso que justificaba el autoguardado.

---

## 12. Móvil

**El admin tiene que funcionar en el iPhone de James.** Va a querer publicar los reels de una boda al día siguiente, no esperar a llegar al escritorio.

- **Sidebar → drawer** por debajo de `lg` (1024px)
- **Grilla a 2 columnas** en móvil
- **Formularios en una sola columna** por debajo de `md`
- **Modales → hojas a pantalla completa**
- **Targets táctiles de 44×44 px mínimo** — los iconos de 24px son imposibles con el pulgar
- **`env(safe-area-inset-bottom)`** en la barra de publicación fija
- **Sin preview en hover** — no existe el hover

### Drag & drop táctil

```ts
useSensor(TouchSensor, {
  activationConstraint: { delay: 200, tolerance: 5 },
});
```

Sin ese `delay`, cualquier toque inicia un arrastre y **la página deja de poder scrollear**. Con 200ms, un toque rápido scrollea y una pulsación mantenida arrastra.

**Botones de mover además del arrastre.** Dos flechas en cada tarjeta. En escritorio se arrastra; en el celular se toca, que es lo que de verdad se usa con más de 8 elementos.

### Orden de bloques en el dashboard

En escritorio el número grande arriba funciona porque se ve todo de un vistazo. **En móvil el orden se invierte: atención primero, clics segundo, almacenamiento tercero.** Lo accionable va arriba; lo demás queda bajo el pliegue.

---

## 13. Descartado a propósito

| | Por qué no |
|---|---|
| Modo claro | El contenido es video sobre oscuro; el claro lo aplana |
| Multiidioma | Un usuario, un idioma |
| Notificaciones push | No hay nada urgente que notificar |
| Roles y permisos elaborados | `ADMIN` y `EDITOR` bastan |
| Personalización de tema | Es su marca, no debería poder romperla |
| Gráficos en el dashboard | Cinco eventos al mes son cuatro puntos |
| Ranking de reels más vistos | R2 no da analítica por objeto; habría que instrumentarlo y no sería significativo |

**Cada uno suena a producto serio y ninguno resuelve algo que James tenga.**

---

## 14. Prioridad

Si hay que elegir, en este orden:

**Imprescindibles** — atacan frustración real

1. **La subida no bloquea nada** + bandeja persistente (§8)
2. **Errores que dicen qué hacer**, no qué pasó (§8)
3. **Estado en la URL** — el que más delata un CRUD generado
4. **Deshacer en vez de confirmar**
5. **Pantalla de sesión expirada** — evita la pérdida de trabajo más frustrante

**Encanto** — hacen que quiera quedarse

6. **Llenado de la miniatura** al subir
7. **Preview y scrub en hover**
8. **⌘K**
9. **Fechas relativas** — la más barata de todas

**Si sobra tiempo**

10. Selección múltiple con barra que sube
11. Navegación con teclado (`j`/`k`)
12. Edición en línea
13. Barra de progreso en la navegación

Los cinco primeros deciden si la herramienta se siente sólida. Del 6 en adelante deciden si se siente cara.
