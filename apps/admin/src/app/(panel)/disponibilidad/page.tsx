import { PantallaDisponibilidad } from '@/features/disponibilidad/components/pantalla-disponibilidad';

export const metadata = { title: 'Disponibilidad · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch. */
export default function Page() {
  return <PantallaDisponibilidad />;
}
