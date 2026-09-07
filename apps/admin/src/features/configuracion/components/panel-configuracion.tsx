'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { SiteSettingsDto } from '@james-film/contracts';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { LuzAmbiente } from '@/components/shared/luz-ambiente';
import { DOMINIO } from '@/lib/enlaces';
import { cn } from '@/lib/utils/cn';
import { esApiError } from '@/lib/api/errors';
import { limpiar } from '@/lib/forms/limpiar';
import { useAjustes, useGuardarAjustes } from '../hooks/use-ajustes';
import { ETIQUETAS, PESTANAS, usePestana, type Pestana } from '../hooks/use-pestana';
import {
  esquemaContacto,
  esquemaHero,
  esquemaIdentidad,
  esquemaSeo,
  type DatosContacto,
  type DatosHero,
  type DatosIdentidad,
  type DatosSeo,
} from '../schemas/ajustes-schema';
import { Hoja } from '@/components/shared/hoja';
import { CampoWhatsapp, sugerirDisplay } from './campo-whatsapp';
import { VistaPreviaHero } from './vista-previa-hero';
import { VistaPreviaSeo } from './vista-previa-seo';
import { ListaDiferenciadores } from './lista-diferenciadores';
import { ListaRedes } from './lista-redes';
import { TextoResaltado } from './texto-resaltado';
import type { DatosAjustes } from '../services/configuracion';

export function PanelConfiguracion() {
  const { data, isPending, isError, refetch } = useAjustes();
  const { pestana, setPestana } = usePestana();
  /**
   * Si la pestaña abierta tiene cambios sin guardar. En un `ref` y NO en un
   * `useState` por dos razones:
   *
   * 1. `Marco` lo avisaba **durante su render**, y eso es un `setState` sobre
   *    el padre mientras React renderiza — prohibido, y React lo grita en
   *    consola. Escribir a un ref no dispara nada.
   * 2. Este panel **no se pinta distinto** según el valor: solo se consulta al
   *    pulsar otra pestaña. Un `useState` re-renderizaba las cinco pestañas y
   *    el formulario entero en la primera tecla, para nada.
   */
  const sucio = useRef(false);
  const marcarSucio = useCallback((v: boolean) => {
    sucio.current = v;
  }, []);
  const [pidiendo, setPidiendo] = useState<Pestana | null>(null);

  if (isPending) return <SkeletonConfiguracion />;

  if (isError) {
    return (
      <div
        role="alert"
        className="border-danger-line bg-danger-bg rounded-card flex flex-col items-start gap-3 border p-6"
      >
        <p className="font-medium">No se pudo cargar la configuración</p>
        <button type="button" onClick={() => void refetch()} className={clasesBoton()}>
          Reintentar
        </button>
      </div>
    );
  }

  const cambiarPestana = (destino: Pestana): void => {
    // Aquí no hay autoguardado —cada campo está EN VIVO en la web— así que
    // cambiar de pestaña con cambios sin guardar los perdería. Se pregunta,
    // no se guarda solo. Y se pregunta en una `Hoja`, NO con `confirm()`: en
    // iOS el nativo sale como un diálogo del SISTEMA y se acepta con el pulgar
    // sin leerlo, que es justo lo contrario de lo que hace falta aquí.
    if (sucio.current) {
      setPidiendo(destino);
      return;
    }
    void setPestana(destino);
  };

  return (
    <div className="relative flex flex-col gap-4">
      <LuzAmbiente className="-right-24 -bottom-56 w-[640px]" />

      <div className="entra">
        <h1 className="font-display text-[clamp(19px,3.5vw,24px)] font-extrabold tracking-[-0.02em]">
          Configuración
        </h1>
        <p className="text-ash mt-1 text-sm">
          Lo que sale en toda la web, no en una galería suelta.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones"
        className="entra border-line sin-barra -mx-4 flex items-center gap-0.5 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        {PESTANAS.map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={pestana === p}
            onClick={() => cambiarPestana(p)}
            className={cn(
              // El filo de latón como `box-shadow` interior y no como `border`:
              // un borde de 2px solo en la activa mueve la fila entera 2px al
              // cambiar de pestaña.
              'flex h-11 shrink-0 items-center px-3.5 text-sm transition-colors duration-150 lg:h-8',
              pestana === p
                ? 'text-bone font-medium shadow-[inset_0_-2px_0_var(--color-brass)]'
                : 'text-ash hover:text-bone',
            )}
          >
            {ETIQUETAS[p]}
          </button>
        ))}
      </div>

      {/* Una key por pestaña: cambiar de pestaña REMONTA el formulario en vez de
          arrastrar el estado del anterior. */}
      <div key={pestana} className="entra" style={{ '--i': 2 } as React.CSSProperties}>
        {pestana === 'identidad' && <Identidad ajustes={data} onSucio={marcarSucio} />}
        {pestana === 'contacto' && <Contacto ajustes={data} onSucio={marcarSucio} />}
        {pestana === 'diferenciadores' && <ListaDiferenciadores />}
        {pestana === 'hero' && <Hero ajustes={data} onSucio={marcarSucio} />}
        {pestana === 'seo' && <Seo ajustes={data} onSucio={marcarSucio} />}
      </div>

      <Hoja
        abierta={pidiendo !== null}
        onCerrar={() => setPidiendo(null)}
        titulo="¿Descartar los cambios?"
        descripcion="Si cambias de pestaña ahora se pierden. Nada de esto está publicado todavía."
      >
        <div className="flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Boton className="flex-1" onClick={() => setPidiendo(null)}>
            Seguir aquí
          </Boton>
          <Boton
            variante="peligro"
            className="flex-1"
            onClick={() => {
              const destino = pidiendo;
              setPidiendo(null);
              marcarSucio(false);
              if (destino) void setPestana(destino);
            }}
          >
            Descartar y salir
          </Boton>
        </div>
      </Hoja>
    </div>
  );
}

/**
 * Cada pestaña construye SU `useForm` con su esquema concreto —de ahí sale el
 * tipado— y comparte solo el envío. Un `useForm` genérico obligaba a castear el
 * resolver, y un `as never` sobre un formulario es justo donde se esconden los
 * errores que esta pantalla no se puede permitir.
 *
 * Y uno por pestaña, no uno global: con uno solo, guardar SEO mandaría también
 * el número de WhatsApp —`whitelist` lo aceptaría tan contento— y pisaría un
 * cambio hecho en otra pestaña o desde el móvil con el valor que esta tenía
 * cargado.
 */
function useEnvio<T extends FieldValues>(form: UseFormReturn<T>, onSucio: (v: boolean) => void) {
  const guardar = useGuardarAjustes();

  const enviar = form.handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync(limpiar(datos) as DatosAjustes);
      onSucio(false);
      // `reset` con lo guardado: así `isDirty` vuelve a false y cambiar de
      // pestaña deja de preguntar.
      form.reset(datos);
      toast.success('Guardado');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  });

  return { enviar, guardando: form.formState.isSubmitting };
}

function Marco<T extends FieldValues>({
  form,
  enviar,
  guardando,
  onSucio,
  previa,
  pie,
  children,
}: {
  form: UseFormReturn<T>;
  enviar: () => void;
  guardando: boolean;
  onSucio: (v: boolean) => void;
  /** La vista previa de la web, en la columna de la derecha y pegada arriba. */
  previa?: ReactNode;
  /**
   * Lo que va DEBAJO de los campos pero ENCIMA de la barra de guardar. Sin
   * esto, la tarjeta de Redes quedaba por debajo del pie pegado y «Guardar»
   * aparecía a media página.
   */
  pie?: ReactNode;
  children: ReactNode;
}) {
  // `isDirty` es lo que decide si preguntar al cambiar de pestaña. Se avisa al
  // padre en un EFECTO, no durante el render: avisarlo en el render es un
  // `setState` sobre otro componente mientras React está pintando, y React lo
  // rechaza («Cannot update a component while rendering a different one»).
  const sucio = form.formState.isDirty;
  useEffect(() => {
    onSucio(sucio);
  }, [sucio, onSucio]);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        noValidate
        className={cn(
          'grid items-start gap-6',
          previa ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : 'max-w-2xl',
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          {children}
          {pie}

          {/* Pegado abajo como la cabecera arriba: con cinco pestañas de campos,
              si no, Guardar queda a un scroll entero de distancia. */}
          <div className="bg-chrome border-line sticky bottom-0 -mx-4 flex items-center gap-2.5 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:mx-0 lg:px-0">
            <span className="text-muted min-w-0 flex-1 truncate text-xs">
              {sucio ? 'Tienes cambios sin guardar' : 'Sin cambios sin guardar'}
            </span>
            {sucio && (
              <Boton onClick={() => form.reset()} disabled={guardando}>
                Descartar
              </Boton>
            )}
            {/* Deshabilitado sin cambios: un PATCH que no cambia nada marcaría
                la web como pendiente de publicar. Y lo pendiente DENTRO del
                botón, nunca en un overlay. */}
            <Boton variante="principal" type="submit" disabled={guardando || !sucio}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>

        {previa && <div className="lg:sticky lg:top-0 lg:self-start">{previa}</div>}
      </form>
    </FormProvider>
  );
}

/**
 * Un campo con su etiqueta y **su ayuda**. La etiqueta dice qué es; la ayuda
 * dice DÓNDE sale y para qué sirve — que es lo que James no puede adivinar y no
 * tiene a quién preguntar. Sin ella, «Frase corta» y «Eslogan» son dos cajas
 * indistinguibles.
 *
 * La ayuda va DEBAJO del campo, no encima: encima se lee antes que la etiqueta
 * y empuja el input; debajo se consulta solo cuando hace falta.
 */
const Campo = ({
  id,
  etiqueta,
  ayuda,
  children,
  error,
  contador,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
  error?: string;
  /** `{ largo, recomendado }` para los campos donde pasarse tiene consecuencia. */
  contador?: { largo: number; recomendado: number };
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline gap-2">
      <label htmlFor={id} className="text-muted text-xs">
        {etiqueta}
      </label>
      {contador && (
        // AVISA, no bloquea: Google recorta por ANCHO, no por caracteres, así
        // que el número es una guía y no un límite. Sin él, un título de 120
        // sale a medias en el buscador sin que nada lo haya dicho.
        <span
          className={cn(
            'ml-auto shrink-0 text-xs tabular-nums',
            contador.largo > contador.recomendado ? 'text-brass' : 'text-muted',
          )}
        >
          {contador.largo} / ~{contador.recomendado}
        </span>
      )}
    </div>
    {children}
    {ayuda && !error && <p className="text-muted text-xs leading-relaxed">{ayuda}</p>}
    {error && (
      <p role="alert" className="text-danger text-sm">
        {error}
      </p>
    )}
  </div>
);

/**
 * `campo`, que es la utilidad del proyecto. Antes era `min-h-11 rounded-md
 * border px-3` a mano: esos inputs se quedaban sin el fondo `card`, sin el
 * radio de control y **sin el foco en latón** — se veían como agujeros negros y
 * el teclado no marcaba dónde estaba.
 */
const claseInput = 'campo border-line';

/**
 * El autorrelleno del navegador **tapa el hint de debajo**: propone «James
 * Films / James Film» sobre la línea que explica dónde sale el campo, que es
 * justo lo que hay que leer. Y no tiene sentido aquí: esto no son los datos de
 * quien rellena un formulario, es el contenido de la web — el navegador no
 * tiene nada útil que sugerir.
 *
 * `data-1p-ignore` y `data-lpignore` hacen lo mismo con 1Password y LastPass,
 * que ignoran `autocomplete="off"`.
 */
const SIN_AUTORRELLENO = {
  autoComplete: 'off',
  'data-1p-ignore': true,
  'data-lpignore': true,
} as const;

function Identidad({
  ajustes,
  onSucio,
}: {
  ajustes: SiteSettingsDto;
  onSucio: (v: boolean) => void;
}) {
  const guardarClaves = useGuardarAjustes();

  const form = useForm<DatosIdentidad>({
    resolver: zodResolver(esquemaIdentidad),
    defaultValues: {
      brandName: ajustes.brandName,
      role: ajustes.role ?? '',
      tagline: ajustes.tagline ?? '',
      slogan: ajustes.slogan ?? '',
      aboutText: ajustes.aboutText ?? '',
    },
  });
  const { enviar, guardando } = useEnvio(form, onSucio);
  const { register, watch, formState, control } = form;
  const enVivo = useWatch({ control });

  // El logo y la firma se guardan AL MOMENTO, sin pasar por «Guardar»: son
  // subidas, no texto, y ya están en R2 cuando el campo avisa. `CampoImagen`
  // se encarga de que la miniatura refleje el quitar sin esperar al refetch.
  const alCambiarImagen = (campo: 'photoKey' | 'logoKey' | 'signatureKey') => (key: string | null) =>
    guardarClaves.mutate({ [campo]: key });

  return (
    <Marco
      form={form}
      enviar={enviar}
      guardando={guardando}
      onSucio={onSucio}
      previa={
        <VistaPreviaHero
          titular={enVivo.tagline ?? ''}
          bajada={enVivo.slogan ?? ''}
          cta={ajustes.ctaText ?? ''}
          numero={ajustes.whatsappDisplay ?? ''}
          posterUrl={ajustes.heroPosterUrl}
        />
      }
    >
      {/* Nombre y oficio caben en una fila: son dos campos cortos, y apilados
          dejaban media pantalla de aire a la derecha. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="brandName"
          etiqueta="Nombre de marca"
          ayuda="Sale en la pestaña del navegador y en el pie."
          error={formState.errors.brandName?.message}
        >
          <input
            id="brandName"
            {...SIN_AUTORRELLENO}
            {...register('brandName')}
            className={claseInput}
          />
        </Campo>
        <Campo id="role" etiqueta="Qué haces" ayuda="Debajo del nombre, en el pie de la web.">
          <input
            id="role"
            {...SIN_AUTORRELLENO}
            placeholder="Creador de contenido"
            {...register('role')}
            className={claseInput}
          />
        </Campo>
      </div>

      <Campo
        id="tagline"
        etiqueta="Frase corta"
        ayuda="El titular grande del hero: lo primero que se lee al entrar. Mira la previa."
      >
        <input
          id="tagline"
          {...SIN_AUTORRELLENO}
          placeholder="Tu evento, en 60 segundos."
          {...register('tagline')}
          className={claseInput}
        />
      </Campo>
      <Campo
        id="slogan"
        etiqueta="Eslogan"
        ayuda="La línea pequeña bajo el titular. Una frase, no dos."
      >
        <input
          id="slogan"
          {...SIN_AUTORRELLENO}
          placeholder="Reels y aftermovies en Ayacucho."
          {...register('slogan')}
          className={claseInput}
        />
      </Campo>

      <Campo
        id="aboutText"
        etiqueta="Sobre ti"
        ayuda="El párrafo de la sección «Sobre mí». Pon **dos asteriscos** alrededor de lo que quieras en dorado."
      >
        <textarea
          id="aboutText"
          {...SIN_AUTORRELLENO}
          rows={5}
          {...register('aboutText')}
          className="campo border-line min-h-0 px-2.5 py-2"
        />
      </Campo>
      {watch('aboutText') && (
        <div className="border-line bg-card rounded-control border p-3">
          <p className="text-muted mb-1.5 text-xs">Así se verá</p>
          <p className="text-sm">
            <TextoResaltado texto={watch('aboutText') ?? ''} />
          </p>
        </div>
      )}

      {/*
        Tu foto va SOLA y en cuadrado: es una cara, no una marca, y compartir
        fila con el logo la dejaba del tamaño de un sello. Hasta hoy ni siquiera
        tenía campo — «Sobre mí» pintaba el LOGO en el círculo de la cara.
      */}
      <CampoImagen
        etiqueta="Tu foto"
        proposito="FOTO_PERFIL"
        valorUrl={ajustes.photoUrl}
        onChange={alCambiarImagen('photoKey')}
        proporcion="1 / 1"
        ayuda="Tu cara, en «Sobre mí». Es la persona que va a estar diez horas dentro de la boda de una hija: verla decide más que cualquier texto."
      />

      {/* Las dos imágenes en una fila: a ancho completo, dos cajas 3:1 se
          comían el doble de alto que todos los campos juntos. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoImagen
          etiqueta="Logo"
          proposito="LOGO"
          valorUrl={ajustes.logoUrl}
          onChange={alCambiarImagen('logoKey')}
          proporcion="3 / 1"
          ayuda="La tira de película, arriba a la izquierda. En SVG si lo tienes: se ve nítido en cualquier tamaño."
        />
        <CampoImagen
          etiqueta="Firma"
          proposito="FIRMA"
          valorUrl={ajustes.signatureUrl}
          onChange={alCambiarImagen('signatureKey')}
          proporcion="3 / 1"
          ayuda="Tu firma manuscrita, al final de «Sobre mí». También en SVG."
        />
      </div>
    </Marco>
  );
}

function Contacto({
  ajustes,
  onSucio,
}: {
  ajustes: SiteSettingsDto;
  onSucio: (v: boolean) => void;
}) {
  const form = useForm<DatosContacto>({
    resolver: zodResolver(esquemaContacto),
    defaultValues: {
      whatsappNumber: ajustes.whatsappNumber ?? '',
      whatsappDisplay: ajustes.whatsappDisplay ?? '',
      whatsappMessage: ajustes.whatsappMessage ?? '',
      ctaText: ajustes.ctaText ?? '',
      email: ajustes.email ?? '',
    },
  });
  const { enviar, guardando } = useEnvio(form, onSucio);
  const { register, formState, control } = form;

  // `useWatch` y no `watch()`: solo re-renderiza la previa, no el formulario
  // entero en cada tecla. Con cinco campos y un marco de móvil delante, la
  // diferencia se nota al escribir.
  const enVivo = useWatch({ control });

  return (
    <Marco
      form={form}
      enviar={enviar}
      guardando={guardando}
      onSucio={onSucio}
      pie={<ListaRedes />}
      previa={
        <VistaPreviaHero
          titular={ajustes.tagline ?? ''}
          bajada={ajustes.slogan ?? ''}
          cta={enVivo.ctaText ?? ''}
          // Lo que verá el visitante es el DISPLAY, no los dígitos crudos: la
          // previa se anuncia «en vivo» y ahí no puede mentir.
          numero={enVivo.whatsappDisplay || sugerirDisplay(enVivo.whatsappNumber ?? '')}
          posterUrl={ajustes.heroPosterUrl}
        />
      }
    >
      {/* WhatsApp en su propia tarjeta con borde: es el negocio entero. Si este
          campo está mal, todo lo demás de esta pantalla da igual. */}
      <fieldset className="border-line-strong rounded-card bg-card elevada flex flex-col gap-3 border px-4 py-4 shadow-[var(--sombra-card),inset_3px_0_0_#25D366]">
        <legend className="flex items-center gap-2 px-1 font-medium">
          <MessageCircle className="size-[15px] shrink-0 text-[#25D366]" aria-hidden />
          WhatsApp
        </legend>
        <p className="text-muted -mt-1 text-xs">
          Todos los botones de la web llevan aquí. Sin prefijo de país no funciona ninguno.
        </p>
        <CampoWhatsapp />
      </fieldset>

      <Campo
        id="whatsappMessage"
        etiqueta="Mensaje que se escribe solo"
        ayuda="Lo que aparece ya escrito en el chat al pulsar el botón. Cuanto más concreto, mejor te responde."
      >
        <input
          id="whatsappMessage"
          {...SIN_AUTORRELLENO}
          placeholder="Hola James, me interesa contratar tus servicios"
          {...register('whatsappMessage')}
          className={claseInput}
        />
      </Campo>
      <Campo
        id="ctaText"
        etiqueta="Texto del botón"
        ayuda="El botón verde del hero y del pie. Mira la previa mientras escribes."
      >
        <input
          id="ctaText"
          {...SIN_AUTORRELLENO}
          placeholder="Escríbeme por WhatsApp"
          {...register('ctaText')}
          className={claseInput}
        />
      </Campo>
      <Campo
        id="email"
        etiqueta="Email"
        ayuda="Opcional. No se pinta ningún botón: el contacto va por WhatsApp."
        error={formState.errors.email?.message}
      >
        <input
          id="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          {...register('email')}
          className={claseInput}
        />
      </Campo>
    </Marco>
  );
}

function Hero({ ajustes, onSucio }: { ajustes: SiteSettingsDto; onSucio: (v: boolean) => void }) {
  const guardarClaves = useGuardarAjustes();
  const form = useForm<DatosHero>({
    resolver: zodResolver(esquemaHero),
    defaultValues: { footerTagline: ajustes.footerTagline ?? '' },
  });
  const { enviar, guardando } = useEnvio(form, onSucio);

  return (
    <Marco
      form={form}
      enviar={enviar}
      guardando={guardando}
      onSucio={onSucio}
      previa={
        <VistaPreviaHero
          titular={ajustes.tagline ?? ''}
          bajada={ajustes.slogan ?? ''}
          cta={ajustes.ctaText ?? ''}
          numero={ajustes.whatsappDisplay ?? ''}
          posterUrl={ajustes.heroPosterUrl}
        />
      }
    >
      {/* Los dos 9:16 en una fila: apilados a ancho completo eran dos pantallas
          de scroll para dos campos. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoImagen
          etiqueta="Vídeo del hero"
          proposito="HERO_VIDEO"
          valorUrl={ajustes.heroMediaUrl}
          onChange={(key) => guardarClaves.mutate({ heroMediaKey: key })}
          proporcion="9 / 16"
          ayuda="MP4 y como mucho 1,5 MB —unos 6 segundos—: se reproduce solo en cada visita, en silencio y en bucle, así que pesa en TODAS las cargas."
        />
        <CampoImagen
          etiqueta="Imagen de reserva"
          proposito="HERO_POSTER"
          valorUrl={ajustes.heroPosterUrl}
          onChange={(key) => guardarClaves.mutate({ heroPosterKey: key })}
          proporcion="9 / 16"
          ayuda="Lo que se ve mientras el vídeo carga, y lo único que ve quien tiene los datos justos. Mejor un JPEG: un PNG del mismo encuadre pesa el triple y esta imagen es lo primero que carga la web."
        />
      </div>
      <Campo
        id="footerTagline"
        etiqueta="Frase del pie"
        ayuda="Va al final de la web, bajo tu firma. Es la despedida, no un segundo titular."
      >
        <input
          id="footerTagline"
          {...SIN_AUTORRELLENO}
          {...form.register('footerTagline')}
          className={claseInput}
        />
      </Campo>
    </Marco>
  );
}

function Seo({ ajustes, onSucio }: { ajustes: SiteSettingsDto; onSucio: (v: boolean) => void }) {
  const guardarClaves = useGuardarAjustes();
  const [ogKey, setOgKey] = useState<string | null | undefined>(undefined);
  const form = useForm<DatosSeo>({
    resolver: zodResolver(esquemaSeo),
    defaultValues: {
      metaTitle: ajustes.metaTitle ?? '',
      metaDescription: ajustes.metaDescription ?? '',
    },
  });
  const { enviar, guardando } = useEnvio(form, onSucio);
  const { register, formState, control } = form;
  const enVivo = useWatch({ control });

  return (
    <Marco
      form={form}
      enviar={enviar}
      guardando={guardando}
      onSucio={onSucio}
      previa={
        <VistaPreviaSeo
          titulo={enVivo.metaTitle ?? ''}
          descripcion={enVivo.metaDescription ?? ''}
          imagenUrl={ogKey === null ? null : ajustes.ogImageUrl}
          dominio={DOMINIO}
        />
      }
    >
      <Campo
        id="metaTitle"
        etiqueta="Título en Google"
        ayuda="Lo que se lee en azul en el buscador. Pon lo que buscaría un cliente: «reels bodas Ayacucho», no «Inicio»."
        error={formState.errors.metaTitle?.message}
        contador={{ largo: (enVivo.metaTitle ?? '').length, recomendado: 60 }}
      >
        <input
          id="metaTitle"
          {...SIN_AUTORRELLENO}
          placeholder="James Film · Reels y aftermovies en Ayacucho"
          {...register('metaTitle')}
          className={claseInput}
        />
      </Campo>
      <Campo
        id="metaDescription"
        etiqueta="Descripción en Google"
        ayuda="Las dos líneas de debajo. No cambia tu posición, pero decide si te pulsan o no."
        contador={{ largo: (enVivo.metaDescription ?? '').length, recomendado: 155 }}
      >
        <textarea
          id="metaDescription"
          {...SIN_AUTORRELLENO}
          rows={3}
          placeholder="Grabo y edito reels y aftermovies para bodas, XV años y cumpleaños en Ayacucho. Entrego en 48 horas."
          {...register('metaDescription')}
          className="campo border-line min-h-0 px-2.5 py-2"
        />
      </Campo>
      <CampoImagen
        etiqueta="Imagen al compartir"
        proposito="OG"
        valorUrl={ajustes.ogImageUrl}
        onChange={(key) => {
          setOgKey(key);
          guardarClaves.mutate({ ogImageKey: key });
        }}
        proporcion="1200 / 630"
        ayuda="Lo que se ve al pegar el enlace en WhatsApp. Apaisada y con poco texto: se pinta muy pequeña."
      />
    </Marco>
  );
}

/** Con la forma real: titular, cinco pestañas y las dos columnas con su previa. */
export function SkeletonConfiguracion() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="bg-card h-7 w-48 animate-pulse rounded" />
      <div className="border-line flex gap-1 border-b pb-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-control bg-active h-8 w-24 animate-pulse" />
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <div className="border-line-strong rounded-card bg-card h-40 animate-pulse border" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="bg-line h-3 w-32 animate-pulse rounded" />
              <div className="rounded-control bg-active h-11 animate-pulse lg:h-9" />
            </div>
          ))}
        </div>
        <div className="border-line-strong bg-well hidden aspect-[9/16] animate-pulse rounded-[22px] border lg:block" />
      </div>
    </div>
  );
}
