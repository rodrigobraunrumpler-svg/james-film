import Link from 'next/link';
import { clasesBoton } from '@/components/shared/boton';

/** Una galería borrada o un id inventado. §5: 404, nunca 403. */
export default function GaleriaNoEncontrada() {
  return (
    <div className="rounded-card border-line-strong flex flex-col items-center gap-4 border border-dashed px-6 py-14 text-center">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Esta galería ya no existe</p>
        <p className="text-ash text-sm">Puede que la hayas borrado desde otro dispositivo.</p>
      </div>
      <Link href="/" className={clasesBoton('principal')}>
        Ver todas las galerías
      </Link>
    </div>
  );
}
