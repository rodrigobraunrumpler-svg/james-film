'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminGalleryDto } from '@james-film/contracts';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { Hoja } from '@/components/shared/hoja';
import type { Respuesta } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { galerias } from '../services/galerias';

/**
 * Publicar es lo único de esta pantalla que cambia lo que ve un cliente de
 * James, así que NO es optimista: el estado se mueve cuando el servidor lo
 * confirma. Lo pendiente se ve dentro del propio botón, nunca en un overlay.
 *
 * **Y la primera vez pasa por una hoja.** En una galería salen caras de gente
 * real, y en los XV años salen MENORES: publicar era un botón sin fricción
 * sobre lo único que puede traerle a James un problema de verdad. La API lo
 * rechaza con 422 `CONSENT_REQUIRED`, pero un 422 llega DESPUÉS de pulsar y se
 * lee como un fallo del sistema, no como una pregunta.
 *
 * En una `Hoja`, nunca con `confirm()`: en iOS el diálogo nativo del SISTEMA se
 * acepta con el pulgar sin leerlo, que es exactamente el fallo del que esta
 * confirmación tiene que proteger.
 */
export function BotonPublicar({ galeria }: { galeria: AdminGalleryDto }) {
  const qc = useQueryClient();
  const [pidiendoPermiso, setPidiendoPermiso] = useState(false);

  const mutacion = useMutation({
    mutationFn: ({ publicar, permiso }: { publicar: boolean; permiso?: boolean }) =>
      galerias.publicar(galeria.id, publicar, permiso),
    onSuccess: (respuesta) => {
      qc.setQueryData<Respuesta<AdminGalleryDto>>(keys.galleries.detail(galeria.id), respuesta);
      void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
      // Toast al TERMINAR, no al empezar.
      toast.success(respuesta.data.isPublished ? 'Galería publicada' : 'Galería despublicada');
    },
    onError: () => toast.error('No se pudo cambiar el estado. Inténtalo otra vez.'),
  });

  const publicada = galeria.isPublished;

  const alPulsar = (): void => {
    // Despublicar NUNCA pregunta: quitar algo de la web es como se atiende una
    // solicitud de cancelación, y ahí la fricción juega en contra.
    if (publicada) {
      mutacion.mutate({ publicar: false });
      return;
    }
    if (galeria.hasConsent) {
      mutacion.mutate({ publicar: true });
      return;
    }
    setPidiendoPermiso(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* El ESTADO y la ACCIÓN son dos cosas: un solo botón que dijera
          «Publicada» no diría qué pasa al pulsarlo. */}
      <span
        className={
          publicada
            ? 'text-brass border-brass rounded-control border px-2 py-1 text-xs'
            : 'text-ash border-line-strong rounded-control border px-2 py-1 text-xs'
        }
      >
        {publicada ? 'Publicada' : 'Borrador'}
      </span>

      <Boton
        variante={publicada ? 'secundario' : 'principal'}
        onClick={alPulsar}
        disabled={mutacion.isPending}
      >
        {mutacion.isPending ? 'Guardando…' : publicada ? 'Pasar a borrador' : 'Publicar galería'}
      </Boton>

      <Hoja
        abierta={pidiendoPermiso}
        onCerrar={() => setPidiendoPermiso(false)}
        titulo="¿Tienes la autorización firmada?"
        descripcion={`Vas a publicar «${galeria.title}» en la web, con las caras que salgan en ese material.`}
      >
        <div className="flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-muted text-xs leading-relaxed">
            Hace falta la hoja de autorización de imagen firmada por quien aparece. Si es un evento
            de XV años, la firman también el padre, la madre o el tutor: la homenajeada es menor de
            edad. Lo pide la Ley 29733 y el artículo 15 del Código Civil.
          </p>
          <div className="flex gap-2">
            <Boton className="flex-1" onClick={() => setPidiendoPermiso(false)}>
              Todavía no
            </Boton>
            <Boton
              variante="principal"
              className="flex-1"
              onClick={() => {
                // Los dos campos en un solo guardado: si fueran dos peticiones y
                // fallara la segunda, la galería quedaría con el permiso marcado
                // y sin publicar, o sea mintiendo sobre lo que se confirmó.
                mutacion.mutate({ publicar: true, permiso: true });
                setPidiendoPermiso(false);
              }}
            >
              Sí, la tengo firmada
            </Boton>
          </div>
        </div>
      </Hoja>
    </div>
  );
}
