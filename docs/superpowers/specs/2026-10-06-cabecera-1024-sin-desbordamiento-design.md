# Cabecera sin desbordamiento a 1024 px

## Problema

En `/testimonios`, la cabecera de escritorio muestra seis enlaces, el selector
de tema y el CTA de WhatsApp con el número completo. Al activarse el breakpoint
`lg` a 1024 px, el conjunto termina en `x=1064`, 40 px fuera de un viewport de
1024 px. El mismo defecto aparece en los dos proyectos de Playwright porque
ambos ejecutan la misma matriz de anchos.

## Alternativas consideradas

1. **Compactar el CTA de WhatsApp entre 1024 y 1279 px (elegida).** Mantiene los
   seis destinos visibles y conserva el objetivo táctil de 48×48 px. El número
   sigue disponible para tecnologías de asistencia y vuelve a mostrarse desde
   1280 px.
2. Mantener la cabecera móvil hasta 1280 px. Evita el desbordamiento, pero
   oculta toda la navegación detrás del diálogo en tablets horizontales y
   escritorios estrechos.
3. Reducir el padding de `marco` en ese rango. Hace caber la cabecera, pero
   cambia el ritmo horizontal de toda la web para resolver un problema local.

## Diseño aprobado

El enlace de WhatsApp de la navegación de escritorio será un botón cuadrado de
48×48 px desde `lg` hasta antes de `xl`. En ese rango mostrará solo el icono;
el número estará dentro de un `span` visualmente oculto para conservar el nombre
accesible. Desde `xl` recuperará el número, el `gap` y el padding actuales.

No se modificarán los enlaces, el selector de tema, el comportamiento del CTA,
el menú móvil ni la utilidad global `marco`.

## Prueba de regresión

El test específico de la cabecera navegará a `/testimonios`, que siempre declara
las seis entradas, y comprobará a 1024 px que:

- ninguna palabra del menú se parte;
- el CTA queda dentro del viewport;
- el documento no tiene scroll horizontal.

Primero se ejecutará este test contra el código actual para confirmar el fallo.
Después del cambio se repetirá y, por último, se ejecutarán el test responsive
completo, el typecheck y el lint de `apps/web`.
