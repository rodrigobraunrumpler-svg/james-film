import { Panel } from '@/features/panel/components/panel';

export const metadata = { title: 'Panel · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch, sin JSX largo. */
export default function Page() {
  return <Panel />;
}
