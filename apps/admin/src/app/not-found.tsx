import Link from 'next/link';
import { clasesBoton } from '@/components/shared/boton';

/** Una URL que no existe: se ofrece la salida, no un 404 a secas. */
export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">Esta página no existe</p>
        <p className="text-ash text-sm">
          Puede que la hayas borrado, o que el enlace esté mal escrito.
        </p>
      </div>
      <Link href="/" className={clasesBoton('principal')}>
        Volver a las galerías
      </Link>
    </div>
  );
}
