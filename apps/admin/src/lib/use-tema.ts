'use client';

import { useCallback, useEffect, useState } from 'react';
import { CLAVE_TEMA, esTema, pintarBarra, type Tema, type TemaAplicado } from './tema';

const consulta = '(prefers-color-scheme: light)';

/** Lo que hay guardado, o «sistema» si no hay nada o el valor está manipulado. */
function leer(): Tema {
  try {
    const v = window.localStorage.getItem(CLAVE_TEMA);
    return esTema(v) ? v : 'sistema';
  } catch {
    // Modo privado de Safari: `localStorage` lanza al leer.
    return 'sistema';
  }
}

/**
 * El tema del admin, con las tres opciones y persistencia.
 *
 * El estado arranca en «sistema» y se corrige tras montar, igual que el saludo
 * del login: en el servidor no hay `localStorage` ni `matchMedia`, y devolver
 * un valor allí y otro aquí es un error de hidratación que tira el árbol
 * entero. El PARPADEO no lo arregla este hook —eso lo hace el script
 * bloqueante del `<head>`—; esto solo sostiene el interruptor.
 */
export function useTema(): {
  tema: Tema;
  aplicado: TemaAplicado;
  elegir: (t: Tema) => void;
  listo: boolean;
} {
  const [tema, setTema] = useState<Tema>('sistema');
  const [sistemaClaro, setSistemaClaro] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setTema(leer());
    const mq = window.matchMedia(consulta);
    setSistemaClaro(mq.matches);
    setListo(true);

    // Mientras esté en «sistema», el panel sigue al dispositivo en vivo: el
    // iPhone cambia solo al anochecer y el admin tiene que ir con él sin
    // recargar.
    const alCambiar = (e: MediaQueryListEvent): void => setSistemaClaro(e.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const aplicado: TemaAplicado =
    tema === 'sistema' ? (sistemaClaro ? 'claro' : 'oscuro') : tema;

  // El atributo se escribe en cada cambio, incluido el del sistema en vivo.
  useEffect(() => {
    if (!listo) return;
    document.documentElement.setAttribute('data-tema', aplicado);
    pintarBarra(aplicado);
  }, [aplicado, listo]);

  const elegir = useCallback((t: Tema) => {
    setTema(t);
    try {
      // «sistema» se BORRA en vez de guardarse: así el script del `<head>` cae
      // solo en `prefers-color-scheme`, sin tener que interpretar un tercer
      // valor antes del primer pintado.
      if (t === 'sistema') window.localStorage.removeItem(CLAVE_TEMA);
      else window.localStorage.setItem(CLAVE_TEMA, t);
    } catch {
      // Cuota llena o modo privado: se pierde la preferencia, no la pantalla.
    }
  }, []);

  return { tema, aplicado, elegir, listo };
}
