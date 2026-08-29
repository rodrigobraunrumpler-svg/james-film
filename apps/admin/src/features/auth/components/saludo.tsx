'use client';

import { useEffect, useState } from 'react';

/**
 * El saludo depende de la hora del DISPOSITIVO, así que se calcula después de
 * montar. Hacerlo en el servidor renderizaría «Buenas tardes» y el navegador
 * «Buenas noches»: React lo detecta como error de hidratación y descarta el
 * árbol entero.
 *
 * Arranca en «Hola», que es cierto a cualquier hora: un hueco vacío haría
 * saltar el titular al llegar el valor.
 */
export function Saludo() {
  const [texto, setTexto] = useState('Hola');

  useEffect(() => {
    const h = new Date().getHours();
    setTexto(
      h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches',
    );
  }, []);

  return <>{texto},</>;
}
