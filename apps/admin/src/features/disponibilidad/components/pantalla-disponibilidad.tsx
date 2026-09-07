'use client';

import type { BookingDto, BusyDayDto, IsoDate, RequestedDateDto } from '@james-film/contracts';
import { AlertCircle, CalendarDays, MessageCircle, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { esApiError } from '@/lib/api/errors';
import { relativo } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { CalendarioMes, type Seleccion } from './calendario-mes';
import { SkeletonDisponibilidad } from './skeleton-disponibilidad';
import {
  cuantoFalta,
  diaLargo,
  diasEntre,
  hoyEnLima,
  masDias,
  masMeses,
  mesYAno,
  primeroDelMes,
  rango,
  rangoLargo,
} from '../fechas';
import { useDiasOcupados, useMarcarDias, useResumenDisponibilidad } from '../hooks/use-disponibilidad';

/**
 * Disponibilidad.
 *
 * El calendario a la izquierda es lo que se toca; la columna de la derecha es
 * lo que se mira. Y lo de la derecha no es relleno: son las cuatro cosas que el
 * calendario le puede decir a James y que hoy no le dice nadie —qué viene, qué
 * grabó y no ha publicado, cuántos sábados le quedan y cuánta gente le escribió
 * desde el calendario—.
 *
 * **Una reserva es un RANGO CONTIGUO**, y por eso se selecciona tocando el
 * primer día y el último en vez de ir sumando días sueltos. Sale de la
 * conversación real que originó el módulo: «quiero para dos días, 24 y 25 de
 * octubre». Dos fines de semana distintos son dos reservas y se marcan dos
 * veces — que es correcto, porque en la base son dos grupos.
 */
export function PantallaDisponibilidad() {
  const hoy = hoyEnLima();
  const [mes, setMes] = useState<IsoDate>(() => primeroDelMes(hoy));
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [nota, setNota] = useState('');

  /**
   * El rango que se pide cubre las semanas de relleno del mes. Sin eso, los
   * días del mes anterior y del siguiente que la rejilla enseña saldrían libres
   * aunque estén ocupados.
   */
  const desde = masDias(primeroDelMes(mes), -7);
  const hasta = masDias(masMeses(primeroDelMes(mes), 1), 7);
  const { data: dias, isPending, isFetching } = useDiasOcupados(desde, hasta);
  const { data: resumen, isPending: cargandoResumen } = useResumenDisponibilidad();
  const marcar = useMarcarDias();

  const ocupados = useMemo(() => {
    const m = new Map<IsoDate, BusyDayDto>();
    for (const d of dias?.data ?? []) m.set(d.date, d);
    return m;
  }, [dias]);

  const elegidos = seleccion ? rango(seleccion.desde, seleccion.hasta) : [];
  const todosOcupados = elegidos.length > 0 && elegidos.every((d) => ocupados.has(d));

  const tocarDia = (fecha: IsoDate): void => {
    setSeleccion((previa) => {
      // Sin selección → empieza. Con un rango ya hecho → vuelve a empezar: el
      // tercer toque es «me equivoqué», no «amplía».
      if (previa === null || previa.desde !== previa.hasta) return { desde: fecha, hasta: fecha };
      if (previa.desde === fecha) return null;
      return previa.desde < fecha
        ? { desde: previa.desde, hasta: fecha }
        : { desde: fecha, hasta: previa.desde };
    });
    // La nota de la reserva que se está tocando, para no reescribirla al
    // ampliarla. Si el día está libre, se empieza en blanco.
    setNota(ocupados.get(fecha)?.note ?? '');
  };

  const aplicar = async (busy: boolean): Promise<void> => {
    if (elegidos.length === 0) return;
    // La nota ANTES de tocar nada: al liberar se borra con la fila, y es lo que
    // «Deshacer» necesita para devolver la reserva entera y no solo los días.
    const notaPrevia = nota.trim() || null;
    const texto = rangoLargo(elegidos[0]!, elegidos[elegidos.length - 1]!);
    const dias = elegidos;

    try {
      await marcar.mutateAsync({ dates: dias, busy, note: busy ? notaPrevia : null });
      setSeleccion(null);
      setNota('');

      if (busy) {
        toast.success(`Ocupado: ${texto}`);
        return;
      }

      /**
       * Liberar es donde duele equivocarse: se va la reserva **y su nota**, y
       * un toque de más sobre un rango ya marcado la borra sin preguntar. El
       * proyecto no usa `confirm()` en ninguna parte y una `Hoja` aquí sería
       * demasiada ceremonia para algo que se hace a menudo — así que se deshace
       * en vez de confirmarse, que además devuelve el estado exacto: los mismos
       * días con la misma nota. Es lo mismo que el borrado de una galería.
       */
      toast.success(`Liberado: ${texto}`, {
        action: {
          label: 'Deshacer',
          onClick: () => {
            marcar.mutate(
              { dates: dias, busy: true, note: notaPrevia },
              {
                onSuccess: () => toast.success(`Vuelve a estar ocupado: ${texto}`),
                onError: () => toast.error('No se pudo deshacer.'),
              },
            );
          },
        },
      });
    } catch (e) {
      // El servidor dice qué pasa —«2026-01-02 ya pasó»— y eso es más útil que
      // un «no se pudo» genérico.
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  };

  /**
   * PRIMERA carga: el esqueleto entero, con la forma real.
   *
   * Se espera también al resumen y no solo al calendario porque el vacío de la
   * derecha MIENTE mientras carga: «Nada cogido por delante. Todo libre.» es
   * una frase, no un hueco, y decía lo contrario de lo que puede ser cierto un
   * segundo después. Los refetch posteriores no vuelven aquí — para eso está el
   * `keepPreviousData` del hook.
   */
  if (isPending || cargandoResumen) return <SkeletonDisponibilidad />;

  return (
    <div className="flex flex-col gap-4">
      {/*
        El «última vez» va DEBAJO del titular y no a su derecha: la esquina
        superior derecha del panel la ocupa el avatar, y ahí la línea se metía
        por debajo y se leía «hace 4 mi…».
      */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">
          Disponibilidad
        </h1>
        {/* Cuándo se tocó por última vez. Es lo que dice si la web está
            contando algo viejo: lo que se publica sale del build. */}
        {resumen?.data.updatedAt && (
          <p className="text-muted text-xs">
            Última vez que lo tocaste: {relativo(resumen.data.updatedAt)}
          </p>
        )}
      </div>
      <p className="text-ash max-w-[62ch] text-sm">
        Marca los días que ya tienes cogidos. Todo lo que no marques sale <strong>libre</strong> en
        la web, así que un mes sin tocar es un mes entero disponible — y es verdad.
      </p>
      {/*
        Y que quede claro CUÁNDO llega a la web. El calendario de la landing va
        horneado en el build, y el despliegue automático es de la fase 6: hoy
        marcar un día no cambia la web hasta la siguiente publicación. Sin
        decirlo, la frase de arriba se lee como que es inmediato — y el fallo
        sería del peor tipo: marca una boda, la web sigue ofreciendo ese sábado
        y alguien escribe pidiéndolo, que es justo lo que el calendario venía a
        evitar.
      */}
      <p className="border-line-strong text-muted rounded-control border border-dashed px-3 py-2 text-xs">
        Lo que marcas aquí sale en la web <strong className="text-ash">en la siguiente
        publicación</strong>, no al momento: el calendario de la web se genera al publicar.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/*
          `px-3` en móvil: cada píxel de padding se lo quita al ancho de las
          celdas, y siete columnas van muy justas. Y `aria-label` en todas las
          secciones porque es lo que usan los tests de la matriz responsive para
          anclarse y para medir qué se sale de qué tarjeta.
        */}
        <section
          aria-label="Calendario de disponibilidad"
          className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border px-3 py-4 lg:px-4"
        >
          {/*
            Al cambiar de mes el calendario NO desaparece: se queda el anterior
            y se atenúa mientras llega el nuevo. Volver al esqueleto teniendo
            datos en pantalla es pasar a tener menos información, no más.
          */}
          <div
            className={cn(
              'transition-opacity duration-150',
              isFetching && 'pointer-events-none opacity-55',
            )}
            aria-busy={isFetching}
          >
            <CalendarioMes
              mes={mes}
              hoy={hoy}
              ocupados={ocupados}
              seleccion={seleccion}
              onMes={(delta) => setMes((m) => masMeses(primeroDelMes(m), delta))}
              onDia={tocarDia}
            />
          </div>

          <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-brass size-1.5 rounded-full" aria-hidden /> Ocupado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-ash size-1.5 rounded-full" aria-hidden /> Hoy
            </span>
            <span>Toca el primer día y el último para coger una reserva de varios.</span>
          </p>

          {/*
            La barra de acción va en el FLUJO y solo con algo elegido: fija
            taparía la última fila del calendario, que es justo la que se está
            tocando a final de mes.
          */}
          {seleccion && (
            <div className="border-line-strong bg-active rounded-control flex flex-col gap-3 border p-3">
              <p className="text-sm">
                <strong className="font-medium">
                  {rangoLargo(seleccion.desde, seleccion.hasta)}
                </strong>{' '}
                <span className="text-muted">
                  · {elegidos.length} {elegidos.length === 1 ? 'día' : 'días'}
                </span>
              </p>

              {/*
                La nota se enseña SIEMPRE, también sobre una reserva que ya
                existe. Antes solo salía al marcar, y eso dejaba un agujero: con
                el rango entero ocupado la única acción era liberar, así que
                corregir una coma de «Boda de Ana» obligaba a destruir la
                reserva y rehacerla — perdiendo el rango y el grupo.
              */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nota-dia" className="text-muted text-xs">
                  Nota privada
                </label>
                <input
                  id="nota-dia"
                  value={nota}
                  maxLength={200}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Boda de Ana · Huanta · pagó adelanto"
                  className="campo border-line"
                />
                {/* Que quede claro dónde NO sale: es un dato de un cliente que
                    no ha dado permiso (Ley 29733). */}
                <p className="text-muted text-xs">
                  Solo la ves tú. En la web ese día dice «ocupado» y nada más.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Boton onClick={() => setSeleccion(null)}>Quitar selección</Boton>
                {/*
                  Sobre una reserva ya marcada hay DOS salidas y las dos hacen
                  falta: guardar la nota —que es el `PUT` con `busy: true`, y de
                  paso reagrupa el rango— o liberarla. La principal es guardar:
                  liberar va en peligro y a la derecha, como el resto del panel.
                */}
                {todosOcupados && (
                  <Boton
                    variante="peligro"
                    disabled={marcar.isPending}
                    onClick={() => void aplicar(false)}
                  >
                    {marcar.isPending ? 'Liberando…' : 'Liberar estos días'}
                  </Boton>
                )}
                <Boton
                  variante="principal"
                  className="ml-auto"
                  disabled={marcar.isPending}
                  onClick={() => void aplicar(true)}
                >
                  {marcar.isPending
                    ? 'Guardando…'
                    : todosOcupados
                      ? 'Guardar la nota'
                      : 'Marcar como ocupado'}
                </Boton>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:sticky lg:top-0">
          <SinPublicar reservas={resumen?.data.sinGaleria ?? []} hoy={hoy} />
          <MasPedidas fechas={resumen?.data.masPedidas ?? []} />
          <LoQueViene reservas={resumen?.data.proximas ?? []} hoy={hoy} />
          <Sabados meses={resumen?.data.sabados ?? []} />
          <Clicks clicks={resumen?.data.clicks} />
        </div>
      </div>
    </div>
  );
}

/**
 * Trabajo grabado y sin publicar. **Va lo PRIMERO**, antes que «lo que viene»:
 * lo de delante ya lo sabe porque lo reservó él; esto no lo sabe nadie, y cada
 * día que pasa es una galería que no está trayendo clientes.
 *
 * Cada aviso lleva su acción. Uno que no se puede resolver desde donde se lee
 * obliga a buscar la pantalla, y entonces se ignora.
 */
function SinPublicar({ reservas, hoy }: { reservas: BookingDto[]; hoy: IsoDate }) {
  if (reservas.length === 0) return null;
  return (
    <section
      aria-label="Grabado y sin publicar"
      className="border-danger-line bg-danger-bg rounded-card flex flex-col gap-2.5 border p-3.5"
    >
      <h2 className="text-danger flex items-center gap-2 text-xs tracking-[0.1em] uppercase">
        <AlertCircle className="size-3.5" aria-hidden />
        Grabado y sin publicar
      </h2>
      <ul className="flex flex-col gap-2">
        {reservas.slice(0, 4).map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{rangoLargo(r.from, r.to)}</span>
            <span className="text-ash text-xs">
              {r.note ?? 'Sin nota'} · {cuantoFalta(r.to, hoy).toLowerCase()}
            </span>
            <Link
              href="/?nueva=1"
              className="text-brass mt-0.5 flex w-fit items-center gap-1.5 text-xs"
            >
              <Plus className="size-3" aria-hidden />
              Crear su galería
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * QUÉ fechas le piden, no cuántas veces le piden algo.
 *
 * Es el dato que convierte la tarjeta de clics en una decisión. «Alguien
 * preguntó por un día cogido» no se puede accionar; «el 24 de octubre te lo han
 * pedido tres veces y lo tienes cogido» sí: ese finde subes el precio, buscas
 * un segundo cámara, o le escribes tú al que preguntó.
 *
 * La landing ya sabía la fecha —la escribe dentro del mensaje de WhatsApp— y la
 * tiraba. Lo único que faltaba era guardarla.
 */
function MasPedidas({ fechas }: { fechas: RequestedDateDto[] }) {
  if (fechas.length === 0) return null;
  return (
    <section
      aria-label="Las fechas más pedidas"
      className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-3.5"
    >
      <h2 className="text-muted flex items-center gap-2 text-xs tracking-[0.1em] uppercase">
        <TrendingUp className="size-3.5" aria-hidden />
        Las fechas más pedidas
      </h2>
      <ul className="flex flex-col gap-1.5">
        {fechas.map((f) => (
          <li key={f.date} className="flex items-baseline justify-between gap-3 text-sm">
            <span className={cn('truncate', f.busy && 'text-brass font-medium')}>
              {diaLargo(f.date)}
            </span>
            <span className="text-ash shrink-0 text-xs tabular-nums">
              {f.count} {f.count === 1 ? 'vez' : 'veces'}
              {/* Cogida es el caso que importa: ahí la petición no acabó en
                  trabajo, acabó en un «lo siento». */}
              {f.busy ? ' · cogida' : ''}
            </span>
          </li>
        ))}
      </ul>
      {fechas.some((f) => f.busy) && (
        <p className="text-muted text-xs">
          Las de latón las tienes cogidas: eso es trabajo que estás rechazando.
        </p>
      )}
    </section>
  );
}

/** Lo que viene. No es un recordatorio —solo saltaría cuando ya está mirando—:
 *  es el estado de la pantalla al abrirla. */
function LoQueViene({ reservas, hoy }: { reservas: BookingDto[]; hoy: IsoDate }) {
  return (
    <section
      aria-label="Lo que viene"
      className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-3.5"
    >
      <h2 className="text-muted flex items-center gap-2 text-xs tracking-[0.1em] uppercase">
        <CalendarDays className="size-3.5" aria-hidden />
        Lo que viene
      </h2>
      {reservas.length === 0 ? (
        // El vacío se DICE. Un hueco no distingue «no hay nada» de «no cargó».
        <p className="text-ash text-sm">Nada cogido por delante. Todo libre.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {reservas.slice(0, 6).map((r) => {
            const faltan = diasEntre(hoy, r.from);
            return (
              <li key={r.id} className="flex flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {rangoLargo(r.from, r.to)}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px]',
                      // Una semana o menos: se resalta. Más allá es agenda, no aviso.
                      faltan <= 7 ? 'bg-brass/15 text-brass' : 'bg-active text-muted',
                    )}
                  >
                    {cuantoFalta(r.from, hoy)}
                  </span>
                </span>
                {r.note && <span className="text-ash text-xs">{r.note}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Los sábados. Es el número que la web publica; que lo vea él antes que el cliente. */
function Sabados({ meses }: { meses: { month: IsoDate; free: number; total: number }[] }) {
  if (meses.length === 0) return null;
  return (
    <section
      aria-label="Sábados libres"
      className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-3.5"
    >
      <h2 className="text-muted text-xs tracking-[0.1em] uppercase">Sábados libres</h2>
      <ul className="flex flex-col gap-1.5">
        {meses.map((m) => (
          <li key={m.month} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="first-letter:uppercase">{mesYAno(m.month)}</span>
            <span className={cn('tabular-nums', m.free === 0 ? 'text-brass' : 'text-ash')}>
              {m.free} de {m.total}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs">
        Contados desde hoy, no desde el día 1. Es lo mismo que dice la web.
      </p>
    </section>
  );
}

/**
 * Lo que el calendario está produciendo. El número de los días OCUPADOS es el
 * interesante: gente que quería una fecha que ya estaba cogida, o sea demanda
 * que se está rechazando.
 */
function Clicks({ clicks }: { clicks?: { free: number; busy: number } }) {
  if (!clicks) return null;
  const total = clicks.free + clicks.busy;
  return (
    <section
      aria-label="Escribieron desde el calendario"
      className="bg-card border-line rounded-card flex flex-col gap-2.5 border p-3.5"
    >
      <h2 className="text-muted flex items-center gap-2 text-xs tracking-[0.1em] uppercase">
        <MessageCircle className="size-3.5" aria-hidden />
        Escribieron desde el calendario
      </h2>
      {total === 0 ? (
        <p className="text-ash text-sm">Todavía nadie, en 30 días.</p>
      ) : (
        <>
          <p className="text-sm">
            <strong className="font-display text-[19px] font-extrabold">{clicks.free}</strong>{' '}
            <span className="text-ash">desde un día libre</span>
          </p>
          <p className="text-sm">
            <strong className="font-display text-brass text-[19px] font-extrabold">
              {clicks.busy}
            </strong>{' '}
            <span className="text-ash">preguntando por uno ya cogido</span>
          </p>
          {clicks.busy > 0 && (
            <p className="text-muted text-xs">
              Ese segundo número es demanda que estás rechazando.
            </p>
          )}
        </>
      )}
      <p className="text-muted text-xs">Últimos 30 días.</p>
    </section>
  );
}
