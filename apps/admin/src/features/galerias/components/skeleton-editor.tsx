/** Con la forma real del formulario: cinco campos, no un rectángulo genérico. */
export function SkeletonEditor() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-7 w-1/3 animate-pulse rounded bg-neutral-200" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
          <div className="h-11 animate-pulse rounded-md bg-neutral-200" />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
        <div className="h-28 animate-pulse rounded-md bg-neutral-200" />
      </div>
    </div>
  );
}
