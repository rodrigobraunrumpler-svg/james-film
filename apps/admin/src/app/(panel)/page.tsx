export const metadata = { title: 'Galerías · James Film' };

/** Ruta fina. La lista real llega en el Task 3. */
export default function Page() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Galerías</h1>
      <p className="text-neutral-600">Aquí irá la lista de eventos.</p>
    </div>
  );
}
