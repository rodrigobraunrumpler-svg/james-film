'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from '@/lib/api/keys';
import { ajustes, type DatosAjustes } from '../services/configuracion';

export function useAjustes() {
  return useQuery({
    queryKey: keys.settings.detail(),
    queryFn: ({ signal }) => ajustes.leer({ signal }),
    select: (r) => r.data,
    /**
     * `staleTime: 0` **solo aquí**. `refetchOnWindowFocus` está apagado para no
     * gastarle datos a James en el móvil, y eso significa que el admin abierto
     * en el portátil desde ayer tiene datos de ayer. En cualquier otra pantalla
     * se recupera; aquí es un registro único con veinte campos y **el número de
     * WhatsApp**, así que abrirla siempre relee.
     */
    staleTime: 0,
  });
}

export function useGuardarAjustes() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosAjustes) => ajustes.actualizar(datos),
    onSuccess: (respuesta) => qc.setQueryData(keys.settings.detail(), respuesta),
  });
}
