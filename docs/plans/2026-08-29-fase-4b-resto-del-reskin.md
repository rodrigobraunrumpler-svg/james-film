# Fase 4b — el resto del re-skin

**Estado:** COMPLETADO el 29-ago-2026. Se conserva por lo que corrige, abajo.
**Depende de:** `aa285ff` (Login, Galerías y Editor ya sobre la guía)
**No depende de:** la fase 6 (`DeployState`) ni de la 3.5 (iPhone de James)

---

## Por qué existe esta fase

`aa285ff` dejó tres pantallas sobre `docs/james-film-admin-ui.md` y **cuatro sin tocar**.
Mientras convivan las dos paletas el admin no está a medias: está roto en la mitad
que James abre para cobrar —paquetes— y en la que puede meterle en un problema legal
—testimonios sin consentimiento—.

El trabajo no es «sustituir clases», y conviene decirlo antes de empezar: **dos de
las cuatro cambian de estructura** porque los prototipos piden tarjetas donde hoy
hay filas.

## Lo que hay hoy, medido

| Pantalla | Ficheros | Líneas | Clases claras | Qué cambia |
|---|---|---|---|---|
| Categorías | `lista-categorias`, `hoja-categoria` | 418 | 11 | Solo estilo |
| Paquetes | `lista-paquetes`, `hoja-paquete`, `campos-bullets` | 576 | 9 | **Filas → tarjetas** |
| Testimonios | `lista-testimonios`, `hoja-testimonio` | 553 | 16 | **Filas → tarjetas + pestañas** |
| Configuración | `panel-configuracion`, `campo-whatsapp`, `lista-diferenciadores`, `lista-redes` | 832 | 21 | Campos densos + vista previa |

Compartido por las tres primeras: `campo-imagen.tsx` (138 líneas, 5 clases claras).

**Lo que ya está resuelto y no hay que rehacer:** `Boton`, `Hoja`, `Selector`,
`CampoFecha`, `ConfirmarBorrado`, `EstadoVacio`, `VerEnLaWeb`, la utilidad `campo`
y los tokens. Las cuatro pantallas tienen su `.dom.spec.tsx`, que es la red que
hace seguro el refactor.

---

## Bloque A · Categorías

**Ficheros:** `lista-categorias.tsx`, `hoja-categoria.tsx`, `components/shared/campo-imagen.tsx`

Es el único sin prototipo propio, así que sigue el patrón de las demás listas:
fila compacta con la portada 16:10 a la izquierda, nombre, el recuento de galerías
que la usan, y los botones de mover.

`campo-imagen` es compartido: hacerlo aquí lo deja listo para B y C.

**Se conserva:** el aviso de cuántas galerías usan la categoría **antes** de pulsar
borrar. El 409 del servidor sigue existiendo —la API no puede fiarse de que la
interfaz haya avisado— pero enterarse después es enterarse tarde.

**Riesgo:** bajo.

---

## Bloque B · Paquetes

**Ficheros:** `lista-paquetes.tsx`, `hoja-paquete.tsx`, `campos-bullets.tsx`
**Prototipo:** `docs/mockups-admin/Paquetes.dc.html`

De filas a **tres tarjetas**: icono en latón, precio grande, bullets, y la del Pro
con borde de latón y «NUESTRO MÁS VENDIDO».

**El detalle que importa:** `isHighlighted` es único y **forzado en la API**. En la
hoja va con radio buttons, no con checkbox — con checkbox James marca dos y recibe
un error que parece un fallo de la aplicación.

**Se conserva:** precios en céntimos y solo enteros (`aCentimos`/`aSoles`), la lista
cerrada de iconos con `<select>` —que aquí sigue siendo correcta: son ~15 opciones
con vista previa, no un desplegable de texto—, y «Ver en la web».

---

## Bloque C · Testimonios

**Ficheros:** `lista-testimonios.tsx`, `hoja-testimonio.tsx`
**Prototipo:** `docs/mockups-admin/Testimonios.dc.html`

Tarjetas con avatar, la captura en 3:4, y **pestañas con contador**
(Todos · Publicados · Borradores · Sin consentimiento). El hook
`useFiltroTestimonios` ya existe con esos cuatro estados.

**La pieza que de verdad importa** es la tarjeta sin consentimiento: captura
difuminada, candado, el motivo escrito, y el botón Publicar **apagado**. Es la Ley
29733 (§19) convertida en interfaz. Hoy es una fila más, indistinguible del resto.

### Trabajo de API: NINGUNO — corregido al construirlo

El plan daba por hecho un `GET /admin/testimonials/counts` copiando el de galerías.
**No hace falta.** `GET /admin/testimonials` no está paginado: devuelve la lista
entera y el filtro ya era de cliente, así que el recuento sale del array que está en
memoria.

La razón por la que galerías SÍ necesitaba endpoint es que su lista está paginada, y
contar el trozo visible mentiría. Copiar el patrón sin comprobar la diferencia habría
añadido un endpoint, sus tests y su caché para calcular un `array.filter().length`.

Lo que sí se conserva es el porqué del contador: es el que le dice a James que tiene
un testimonio que no puede publicar. Va en rojo aunque su pestaña no esté activa.

**Se conserva:** `isActive` nace en `false` y no se publica sin `hasConsent`.

---

## Bloque D · Configuración

**Ficheros:** `panel-configuracion.tsx`, `campo-whatsapp.tsx`, `lista-diferenciadores.tsx`, `lista-redes.tsx`
**Prototipo:** `docs/mockups-admin/Configuracion.dc.html`

Cinco pestañas (Identidad · Contacto y redes · Diferenciadores · Hero · SEO), campos
densos de 34px, el bloque de WhatsApp con «Probar este número», y la lista de redes
con sus botones de orden.

**Se conserva:** un `useForm` por pestaña. Con uno global, guardar SEO mandaría
también el número de WhatsApp y pisaría un cambio hecho desde el móvil.

**La vista previa embebida va al final**, después de que las cuatro pantallas estén.
Cuando entre: **no comparte código con `apps/web`**. Sería acoplar dos aplicaciones
que se despliegan por separado, y el día que la landing cambie el hero el admin
dejaría de compilar por un cambio de maquetación. Copia simplificada.

---

## Orden y por qué

**A → B → C → D.**

A deja `campo-imagen` listo para B y C. C es el que trae trabajo de API, así que va
cuando el patrón de tarjetas ya está probado en B. D es la que menos se parece a
todo lo demás y la única con trabajo aplazado dentro.

## Verificación, después de cada bloque

- `typecheck` · `lint` · los tests unitarios de la pantalla
- El E2E responsive: su bucle `PANTALLAS` ya recorre las cuatro a 320px, así que
  entran solas sin escribir test nuevo
- Para C, un test de integración del endpoint de recuentos, con la comprobación de
  que `/counts` no lo captura la ruta `:id`

**Y una regla que sale de lo aprendido hoy:** cualquier cosa que se pulse por encima
de otra lleva su prueba en el E2E, no solo en el dom. Testing Library pulsa el nodo
sin hit-testing, así que una capa invisible por encima pasa desapercibida con los
tests en verde. Ya ocurrió una vez.

---

## Lo que esta fase NO hace

| | Por qué |
|---|---|
| Barra de publicación y pantalla «Panel» | Cuelgan de `DeployState`, fase 6 |
| Multipart y suelo de iOS | Fase 3.5, necesitan el iPhone de James |
| Vista previa de Configuración | Entra al final del bloque D, aparte |
| Buscador en las tres listas | Con decenas de filas las pestañas bastan. Se revisa si crece |

## Riesgos

**El único real es C**: cambia estructura, toca la API y es la pantalla con
consecuencia legal. Si algo se sale de tiempo, es ahí.

**El resto es mecánico** salvo por una cosa que conviene vigilar: los `.dom.spec.tsx`
de las cuatro pantallas asertan sobre textos y roles. Si al pasar a tarjetas
desaparece un texto que un test usaba como ancla —como pasó con el nombre bajo la
miniatura en el editor— hay que **actualizar el ancla, no el diseño**, y dejar
escrito por qué.
