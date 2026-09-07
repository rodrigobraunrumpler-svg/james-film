import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export const DocDisponibilidadPublica = (): MethodDecorator =>
  ApiDoc({
    summary: 'Los días ocupados de los próximos 12 meses',
    description:
      'Lo hornea el build de Astro. **Por defecto todo está libre**: se guardan ' +
      'los días ocupados, nunca los libres, así que con la tabla vacía el año ' +
      'entero sale libre y es verdad.\n\n' +
      '**No acepta ningún parámetro**, y es a propósito: un endpoint público ' +
      'que no recibe nada no se puede filtrar mal. Y **nunca lleva la nota** — ' +
      'es información de un cliente que no dio permiso para publicarla ' +
      '(Ley 29733). En la web un día ocupado dice «ocupado» y nada más.\n\n' +
      '`until` es imprescindible: sin él la landing no puede distinguir ' +
      '«libre» de «no lo sé», y un día a catorce meses saldría libre.',
  });

export const DocListarDias = (): MethodDecorator =>
  ApiDoc({
    summary: 'Los días ocupados de un rango, con su nota privada',
    description:
      'Solo para el panel. A diferencia del público, este SÍ lleva la nota y el ' +
      '`groupId` — los días marcados a la vez comparten grupo, que es lo que ' +
      'convierte «24 y 25 de octubre» en una boda y no en dos días sueltos.',
    auth: true,
  });

export const DocResumen = (): MethodDecorator =>
  ApiDoc({
    summary: 'Todo lo que la pantalla de Disponibilidad necesita, de una vez',
    description:
      'Una sola petición y no cuatro, por el mismo motivo que el Panel: la ' +
      'pantalla no se puede pintar a trozos y cuatro respuestas darían cuatro ' +
      'saltos de layout en el 4G de James.\n\n' +
      'Trae las **próximas reservas** ya agrupadas, los **sábados libres** de ' +
      'los tres próximos meses —contados desde HOY, no desde el día 1—, las ' +
      'reservas **que ya pasaron y no tienen galería** (trabajo grabado y sin ' +
      'publicar) y los **clics que salieron del calendario** en 30 días, ' +
      'separando el día libre del ocupado: el segundo mide la demanda que se ' +
      'está rechazando.',
    auth: true,
  });

export const DocMarcarDias = (): MethodDecorator =>
  ApiDoc({
    summary: 'Marca o desmarca días como ocupados',
    description:
      'Un solo endpoint para el toque, el arrastre y el rango. Marcar varias ' +
      'fechas de una vez las mete en el **mismo grupo**.\n\n' +
      '**Idempotente en los dos sentidos**: marcar lo ya marcado no duplica ni ' +
      'lanza P2002, y desmarcar lo que no existe responde 200, no 404.\n\n' +
      'Solo se rechaza **marcar** en pasado, nunca **desmarcar**: un día mal ' +
      'puesto se tiene que poder quitar, y equivocarse arrastrando un rango es ' +
      'justo lo que va a pasar. El «pasado» se compara contra la hora de Lima, ' +
      'no contra UTC — si no, a las 20:00 de Ayacucho el día de hoy ya contaría ' +
      'como pasado.',
    errors: [422],
    auth: true,
  });
