'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Buscar por título. El estado vive en la URL como todo lo demás, pero con
 * 300 ms de retraso: sin eso cada tecla es una petición y una entrada en el
 * historial del navegador, y el botón atrás tendría que pulsarse una vez por
 * letra escrita.
 */
export function BuscadorGalerias({
  valor,
  alBuscar,
}: {
  valor: string;
  alBuscar: (q: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const input = useRef<HTMLInputElement>(null);
  const [atajo, setAtajo] = useState<string | null>(null);

  // Se resuelve tras montar: en el servidor no hay plataforma que mirar, y
  // pintar «⌘K» y cambiarlo a «Ctrl K» al hidratar sería un error de hidratación.
  useEffect(() => {
    setAtajo(/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K');
  }, []);

  // La URL puede cambiar por fuera: al limpiar la búsqueda desde el estado
  // vacío, o al volver atrás. El campo tiene que seguirla.
  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    if (texto === valor) return;
    const id = setTimeout(() => alBuscar(texto), 300);
    return () => clearTimeout(id);
  }, [texto, valor, alBuscar]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Sin esto, Ctrl+K abre la barra de direcciones en Firefox.
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  return (
    <div className="relative flex min-w-0 flex-1 items-center lg:flex-none">
      <Search className="text-muted pointer-events-none absolute left-2.5 size-3.5" aria-hidden />
      <input
        ref={input}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTexto('');
            input.current?.blur();
          }
        }}
        placeholder="Buscar…"
        aria-label="Buscar galerías por título"
        maxLength={100}
        // No usa `.campo`: eso es el input de un formulario (hueco oscuro, borde
        // fuerte). Este vive en la cabecera y se lee como parte del chrome.
        // El `pr` deja hueco al atajo; sin él el texto pasa por debajo.
        className="bg-card border-line rounded-control text-bone placeholder:text-muted focus-visible:border-line-hover min-h-11 w-full border pr-9 pl-8 outline-none lg:h-8 lg:min-h-0 lg:w-58 lg:pr-14"
      />
      {texto ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setTexto('');
            input.current?.focus();
          }}
          className="text-ash hover:text-bone absolute right-2 flex size-7 items-center justify-center rounded transition-colors duration-150"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : (
        atajo && (
          <span
            aria-hidden
            className="border-line-strong text-muted pointer-events-none absolute right-2.5 hidden rounded border px-[5px] py-px text-[10px] lg:block"
          >
            {atajo}
          </span>
        )
      )}
    </div>
  );
}
