'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { SiteSettingsDto } from '@james-film/contracts';
import { useState, type ReactNode } from 'react';
import { FormProvider, useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { Boton } from '@/components/shared/boton';
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
import { CampoWhatsapp } from './campo-whatsapp';
import { ListaDiferenciadores } from './lista-diferenciadores';
import { ListaRedes } from './lista-redes';
import { TextoResaltado } from './texto-resaltado';
import type { DatosAjustes } from '../services/configuracion';

export function PanelConfiguracion() {
  const { data, isPending, isError, refetch } = useAjustes();
  const { pestana, setPestana } = usePestana();
  const [sucio, setSucio] = useState(false);

  if (isPending) return <SkeletonConfiguracion />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudo cargar la configuración</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const cambiarPestana = (destino: Pestana): void => {
    // Aquí no hay autoguardado —cada campo está EN VIVO en la web— así que
    // cambiar de pestaña con cambios sin guardar los perdería. Se pregunta,
    // no se guarda solo.
    if (sucio && !confirm('Tienes cambios sin guardar en esta pestaña. ¿Los descartas?')) return;
    setSucio(false);
    void setPestana(destino);
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones"
        className="border-line flex items-center gap-5 overflow-x-auto border-b"
      >
        {PESTANAS.map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={pestana === p}
            onClick={() => cambiarPestana(p)}
            className={cn(
              '-mb-px flex h-11 shrink-0 items-center border-b-2 transition-colors duration-150 lg:h-10',
              pestana === p
                ? 'border-brass text-bone font-medium'
                : 'text-ash hover:text-bone border-transparent',
            )}
          >
            {ETIQUETAS[p]}
          </button>
        ))}
      </div>

      {/* Una key por pestaña: cambiar de pestaña REMONTA el formulario en vez de
          arrastrar el estado del anterior. */}
      <div key={pestana}>
        {pestana === 'identidad' && <Identidad ajustes={data} onSucio={setSucio} />}
        {pestana === 'contacto' && (
          <div className="flex flex-col gap-8">
            <Contacto ajustes={data} onSucio={setSucio} />
            <ListaRedes />
          </div>
        )}
        {pestana === 'diferenciadores' && <ListaDiferenciadores />}
        {pestana === 'hero' && <Hero ajustes={data} onSucio={setSucio} />}
        {pestana === 'seo' && <Seo ajustes={data} onSucio={setSucio} />}
      </div>
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
  children,
}: {
  form: UseFormReturn<T>;
  enviar: () => void;
  guardando: boolean;
  onSucio: (v: boolean) => void;
  children: ReactNode;
}) {
  // `isDirty` es lo que decide si preguntar al cambiar de pestaña.
  if (form.formState.isDirty) onSucio(true);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        noValidate
        className="flex max-w-2xl flex-col gap-4"
      >
        {children}
        {/* Lo pendiente DENTRO del botón, nunca en un overlay. */}
        <Boton variante="principal" type="submit" className="self-start" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </form>
    </FormProvider>
  );
}

const Campo = ({
  id,
  etiqueta,
  children,
  error,
}: {
  id: string;
  etiqueta: string;
  children: ReactNode;
  error?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-muted text-xs">
      {etiqueta}
    </label>
    {children}
    {error && (
      <p role="alert" className="text-danger text-sm">
        {error}
      </p>
    )}
  </div>
);

const claseInput = 'min-h-11 rounded-md border px-3';

function Identidad({
  ajustes,
  onSucio,
}: {
  ajustes: SiteSettingsDto;
  onSucio: (v: boolean) => void;
}) {
  const [logoKey, setLogoKey] = useState<string | null | undefined>(undefined);
  const [signatureKey, setSignatureKey] = useState<string | null | undefined>(undefined);
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
  const { register, watch, formState } = form;

  const alCambiarImagen = (campo: 'logoKey' | 'signatureKey') => (key: string | null) => {
    if (campo === 'logoKey') setLogoKey(key);
    else setSignatureKey(key);
    guardarClaves.mutate({ [campo]: key });
  };

  return (
    <Marco form={form} enviar={enviar} guardando={guardando} onSucio={onSucio}>
      <Campo id="brandName" etiqueta="Nombre de marca" error={formState.errors.brandName?.message}>
        <input id="brandName" {...register('brandName')} className={claseInput} />
      </Campo>
      <Campo id="role" etiqueta="Qué haces">
        <input
          id="role"
          placeholder="Creador de contenido"
          {...register('role')}
          className={claseInput}
        />
      </Campo>
      <Campo id="tagline" etiqueta="Frase corta">
        <input id="tagline" {...register('tagline')} className={claseInput} />
      </Campo>
      <Campo id="slogan" etiqueta="Eslogan">
        <input id="slogan" {...register('slogan')} className={claseInput} />
      </Campo>

      <Campo id="aboutText" etiqueta="Sobre ti">
        <textarea
          id="aboutText"
          rows={5}
          {...register('aboutText')}
          className="campo bg-well border-line min-h-0 px-2.5 py-2"
        />
      </Campo>
      <div className="border-line bg-card rounded-control border p-3">
        <p className="text-muted mb-1.5 text-xs">
          Así se verá. Pon **dos asteriscos** alrededor de lo que quieras resaltar.
        </p>
        <p className="text-sm">
          <TextoResaltado texto={watch('aboutText') ?? ''} />
        </p>
      </div>

      <CampoImagen
        etiqueta="Logo"
        proposito="LOGO"
        valorUrl={logoKey === null ? null : ajustes.logoUrl}
        onChange={alCambiarImagen('logoKey')}
        proporcion="3 / 1"
        ayuda="En SVG si lo tienes: se ve nítido en cualquier tamaño."
      />
      <CampoImagen
        etiqueta="Firma"
        proposito="FIRMA"
        valorUrl={signatureKey === null ? null : ajustes.signatureUrl}
        onChange={alCambiarImagen('signatureKey')}
        proporcion="3 / 1"
      />
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
  const { register, formState } = form;

  return (
    <Marco form={form} enviar={enviar} guardando={guardando} onSucio={onSucio}>
      <CampoWhatsapp />
      <Campo id="whatsappMessage" etiqueta="Mensaje que se escribe solo">
        <input id="whatsappMessage" {...register('whatsappMessage')} className={claseInput} />
      </Campo>
      <Campo id="ctaText" etiqueta="Texto del botón">
        <input
          id="ctaText"
          placeholder="Escríbeme"
          {...register('ctaText')}
          className={claseInput}
        />
      </Campo>
      <Campo id="email" etiqueta="Email" error={formState.errors.email?.message}>
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
    <Marco form={form} enviar={enviar} guardando={guardando} onSucio={onSucio}>
      <CampoImagen
        etiqueta="Vídeo del hero"
        proposito="HERO_VIDEO"
        valorUrl={ajustes.heroMediaUrl}
        onChange={(key) => guardarClaves.mutate({ heroMediaKey: key })}
        proporcion="9 / 16"
        ayuda="Autoplayea en cada visita: máximo 1,5 MB y unos 6 segundos."
      />
      <CampoImagen
        etiqueta="Imagen de reserva del hero"
        proposito="HERO_POSTER"
        valorUrl={ajustes.heroPosterUrl}
        onChange={(key) => guardarClaves.mutate({ heroPosterKey: key })}
        proporcion="9 / 16"
      />
      <Campo id="footerTagline" etiqueta="Frase del pie">
        <input id="footerTagline" {...form.register('footerTagline')} className={claseInput} />
      </Campo>
    </Marco>
  );
}

function Seo({ ajustes, onSucio }: { ajustes: SiteSettingsDto; onSucio: (v: boolean) => void }) {
  const guardarClaves = useGuardarAjustes();
  const form = useForm<DatosSeo>({
    resolver: zodResolver(esquemaSeo),
    defaultValues: {
      metaTitle: ajustes.metaTitle ?? '',
      metaDescription: ajustes.metaDescription ?? '',
    },
  });
  const { enviar, guardando } = useEnvio(form, onSucio);
  const { register, formState } = form;

  return (
    <Marco form={form} enviar={enviar} guardando={guardando} onSucio={onSucio}>
      <Campo id="metaTitle" etiqueta="Título en Google" error={formState.errors.metaTitle?.message}>
        <input id="metaTitle" {...register('metaTitle')} className={claseInput} />
      </Campo>
      <Campo id="metaDescription" etiqueta="Descripción en Google">
        <textarea
          id="metaDescription"
          rows={2}
          {...register('metaDescription')}
          className="campo bg-well border-line min-h-0 px-2.5 py-2"
        />
      </Campo>
      <CampoImagen
        etiqueta="Imagen al compartir"
        proposito="OG"
        valorUrl={ajustes.ogImageUrl}
        onChange={(key) => guardarClaves.mutate({ ogImageKey: key })}
        proporcion="1200 / 630"
        ayuda="Es lo que se ve al pegar el enlace en WhatsApp."
      />
    </Marco>
  );
}

export function SkeletonConfiguracion() {
  return (
    <div className="flex max-w-2xl flex-col gap-4" aria-hidden>
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-control bg-active h-11 w-24 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="bg-line h-4 w-32 animate-pulse rounded" />
          <div className="rounded-control bg-active h-11 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
