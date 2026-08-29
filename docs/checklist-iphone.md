# Checklist del iPhone de James — fase 3.5

Lo que **no** se puede automatizar. Cuatro comportamientos de Safari en iOS se
portan distinto en el dispositivo real, y el modo dispositivo de DevTools no
reproduce ninguno: el Wake Lock, la decodificación de vídeo, el HEIC y el
selector de archivos.

Va todo en la misma sesión de 15 minutos que ya estaba pendiente con James.

---

## 0. Lo primero, porque puede invalidar lo demás

- [ ] **Qué versión de iOS tiene.** Tres piezas tienen suelos distintos:
  - `AbortSignal.any` → **Safari 17.4+**, y lo usa el cliente HTTP en *todas*
    las peticiones. Por debajo, el admin no falla al subir: falla en la
    **primera petición**, con un `TypeError` que no menciona la versión.
  - Wake Lock y `canvas.toBlob` → **16.4+**.
- [ ] **Que entre al admin y cargue la lista de galerías.** Si esto falla, es
      la versión de iOS, no la red.

## 1. Un export REAL de CapCut  🔴

Es el riesgo más gordo que abrió la Task 5: la validación **rechaza** un MP4
cuyo `moov` va detrás del `mdat`. Si CapCut exporta así, James **no podrá subir
absolutamente nada**.

- [ ] Que exporte un reel como lo hace siempre y lo suba.
- [ ] Si sale *«no está preparado para reproducirse en la web»*, el archivo no
      trae faststart. **La salida es degradar esa comprobación a aviso** —el
      vídeo se sube igual, solo tarda más en arrancar en la landing— no quitarla
      ni dejarla bloqueando.
- [ ] Anotar también el **códec** que le sale: si CapCut exporta HEVC por
      defecto en su iPhone, hay que enseñarle dónde se cambia a H.264 antes de
      que suba nada.

## 2. Subir de verdad, por 4G  🔴

Con datos móviles, **no con wifi**. Es como va a trabajar desde un evento.

- [ ] Un reel de ~35 MB.
- [ ] **Un aftermovie de ~115 MB**: es el que decide si hace falta multipart.
- [ ] Ocho reels de golpe: que la concurrencia 3 no sature la conexión.
- [ ] Que el **progreso avance de verdad** y no se quede parado.
- [ ] Mirar si salta el **vigilante de estancamiento** (30 s sin ningún evento)
      en una conexión que en realidad va bien. Si salta de más, subir el umbral.

**La decisión de multipart sale de aquí.** Si el aftermovie sube entero por 4G,
nos hemos ahorrado la pieza más frágil del editor. Si se corta a la mitad de
forma repetible, entra multipart en la fase siguiente.

## 3. Lo que solo rompe en Safari de verdad

- [ ] **Bloquear la pantalla a mitad de subida** y volver. Debe reanudar o
      marcar el fallo con un motivo, nunca quedarse en «Subiendo» para siempre.
      (El Wake Lock solo evita el auto-bloqueo por inactividad: contra el botón
      de encendido no puede nada. La red es la reconciliación al volver.)
- [ ] **Cambiar de app** (WhatsApp) 30 segundos y volver.
- [ ] **Recargar la pestaña** con una subida a medias: los `PENDING` deben
      reconciliarse solos al abrir el editor, sin volver a subir un byte.
- [ ] **Una llamada entrante** durante una subida.

## 4. HEIC

No es automatizable: ningún navegador de Linux lo decodifica, tampoco el WebKit
de Playwright.

- [ ] Subir una foto **tal cual sale de la cámara** (HEIC).
- [ ] Que llegue como JPEG y **no salga girada**: si sale tumbada, el
      `imageOrientation: 'from-image'` no está haciendo efecto en su Safari.

## 5. El selector de archivos

- [ ] Que «Elegir archivos» abra el **carrete**, no la cámara.
- [ ] Que deje elegir **varios** de una vez.
- [ ] Que el campo de fecha abra el **selector nativo de iOS**.

## 6. Con el pulgar

Lo medible ya lo cubre el E2E (320 px sin scroll horizontal, zoom 200%,
horizontal, 44 px). Aquí va lo que solo se ve usándolo:

- [ ] Que llegue a los botones de mover **con una mano**.
- [ ] Que la barra de progreso no le tape nada que necesite pulsar.
      (Ya pasó una vez: era `fixed` y tapaba el botón de Cancelar. Lo cazó el
      E2E, pero conviene mirarlo en pantalla pequeña.)

---

## Lo que se decide al terminar

1. **Multipart, sí o no** (§10 lo daba por hecho; se decide con el dato).
2. **Faststart: bloqueo o aviso.**
3. Si hay que **bajar el suelo de iOS** sustituyendo `AbortSignal.any`.
