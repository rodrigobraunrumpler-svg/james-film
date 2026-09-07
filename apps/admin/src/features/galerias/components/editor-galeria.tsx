'use client';

import { ChevronRight, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { ConfirmarBorrado } from '@/components/shared/confirmar-borrado';
import { Hoja } from '@/components/shared/hoja';
import { VerEnLaWeb } from '@/components/shared/ver-en-la-web';
import { esApiError } from '@/lib/api/errors';
import { urlGaleria } from '@/lib/enlaces';
import { useBorrarGaleria, useDestacarGaleria } from '../hooks/use-crear-galeria';
import { useCategorias, useGaleria, useReconciliarPendientes } from '../hooks/use-galeria';
import { BotonPublicar } from './boton-publicar';
import { FormularioGaleria } from './formulario-galeria';
import { GrillaMedios } from './grilla-medios';
import { SkeletonEditor } from './skeleton-editor';

export function EditorGaleria({ id }: { id: string }) {
  const galeria = useGaleria(id);
  const categorias = useCategorias();
  const borrar = useBorrarGaleria();
  const destacar = useDestacarGaleria(id);
  const [borrando, setBorrando] = useState(false);

  // Step 0: los PENDING que dejó una pestaña muerta se re-confirman al montar.
  // Va antes de cualquier return: los hooks no pueden ir detrás de una rama.
  useReconciliarPendientes(galeria.data);

  if (galeria.isPending || categorias.isPending) return <SkeletonEditor />;

  if (galeria.isError || categorias.isError) {
    const error = galeria.error ?? categorias.error;
    const esNoEncontrada = esApiError(error) && error.isNotFound;

    return (
      <div
        role="alert"
        className="border-danger-line bg-danger-bg rounded-card flex flex-col items-start gap-3 border p-5"
      >
        <p className="font-medium">
          {esNoEncontrada ? 'Esta galería ya no existe' : 'No se pudo cargar la galería'}
        </p>
        {!esNoEncontrada && (
          <Boton
            onClick={() => {
              void galeria.refetch();
              void categorias.refetch();
            }}
          >
            Reintentar
          </Boton>
        )}
      </div>
    );
  }

  const datos = galeria.data;

  return (
    <div className="flex flex-col gap-5">
      {/* key por id: navegar de una galería a otra REMONTA el formulario en vez
          de reusar el estado de la anterior, que es cómo se guardan los datos
          de una galería sobre otra. */}
      <FormularioGaleria
        key={datos.id}
        galeria={datos}
        categorias={categorias.data}
        migas={
          <nav aria-label="Migas de pan" className="text-ash flex items-center gap-1.75 text-sm">
            <Link href="/" className="hover:text-bone transition-colors duration-150">
              Galerías
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <span className="dato truncate">{datos.title}</span>
          </nav>
        }
        acciones={
          <>
            {/* Solo si está publicada: enlazar a una URL que devuelve 404 es peor
                que no ofrecer el enlace. */}
            {datos.isPublished && <VerEnLaWeb url={urlGaleria(datos.slug)} />}
            <BotonPublicar galeria={datos} />
          </>
        }
      />

      <GrillaMedios galeria={datos} />

      {/* Abajo y en voz baja: destacar y borrar no son lo que James viene a
          hacer aquí, y borrar es lo único de esta pantalla que no se deshace
          desde la propia pantalla. */}
      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-4">
        {/* «La primera de la web», no «destacar en la portada». Este botón no
            pinta ninguna insignia: lo único que hace es ganar el orden de la
            lista pública, y de ahí sale el trabajo que encabeza el hero, la
            tarjeta alta del bento y la rejilla de Trabajos. El nombre anterior
            prometía un adorno y hacía un orden. */}
        <Boton
          onClick={() => destacar.mutate(!datos.isFeatured)}
          aria-pressed={datos.isFeatured}
          title="Sale la primera en el hero, en el bento y en la rejilla de Trabajos. Solo puede haber una."
          className={datos.isFeatured ? 'border-brass text-brass' : undefined}
        >
          <Star className={datos.isFeatured ? 'size-3.5 fill-current' : 'size-3.5'} aria-hidden />
          {datos.isFeatured ? 'Es la primera de la web' : 'Ponerla la primera en la web'}
        </Boton>
        <Boton variante="peligro" className="ml-auto" onClick={() => setBorrando(true)}>
          Borrar galería
        </Boton>
      </div>

      <Hoja
        abierta={borrando}
        onCerrar={() => setBorrando(false)}
        titulo="Borrar la galería"
        descripcion="Esto no se puede deshacer desde aquí."
      >
        <ConfirmarBorrado
          nombre={datos.title}
          descripcion={
            datos.media.length > 0
              ? `Se borrarán también sus ${datos.media.length} archivos, y el enlace que hayas compartido dejará de funcionar.`
              : 'El enlace que hayas compartido dejará de funcionar.'
          }
          cargando={borrar.isPending}
          onCancelar={() => setBorrando(false)}
          onConfirmar={() => {
            borrar.mutate(id, {
              onSuccess: () => toast.success('Galería borrada'),
              onError: () => toast.error('No se pudo borrar.'),
            });
          }}
        />
      </Hoja>
    </div>
  );
}
