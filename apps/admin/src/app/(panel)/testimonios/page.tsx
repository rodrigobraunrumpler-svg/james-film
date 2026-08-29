import { ListaTestimonios } from '@/features/testimonios/components/lista-testimonios';

export const metadata = { title: 'Testimonios · James Film' };

/** El h1 vive dentro de la lista: comparte fila con «Nuevo testimonio». */
export default function Page() {
  return <ListaTestimonios />;
}
