import { ListaPaquetes } from '@/features/paquetes/components/lista-paquetes';

export const metadata = { title: 'Paquetes · James Film' };

export default function Page() {
  // El h1 vive dentro de la lista: comparte fila con «Nuevo paquete».
  return <ListaPaquetes />;
}
