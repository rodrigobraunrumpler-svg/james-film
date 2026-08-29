import { EditorGaleria } from '@/features/galerias/components/editor-galeria';

export const metadata = { title: 'Editar galería · James Film' };

/** Ruta fina: resuelve el param y delega. Sin lógica ni fetch. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorGaleria id={id} />;
}
