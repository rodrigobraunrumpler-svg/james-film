'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { esquemaLogin, type DatosLogin } from '../schemas/login-schema';
import { ErrorLogin, iniciarSesion } from '../services/login';

/** El mensaje se elige por `code`, nunca comparando la cadena del servidor. */
function mensajeDe(error: unknown): string {
  if (!(error instanceof ErrorLogin)) return 'No se pudo conectar. Revisa tu conexión.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Email o contraseña incorrectos.';
    case 'RATE_LIMITED':
      return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    default:
      return error.message;
  }
}

export function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosLogin>({ resolver: zodResolver(esquemaLogin) });

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      await iniciarSesion(datos);
      // `desde` lo pone proxy.ts al redirigir: se vuelve a donde iba.
      router.replace(params.get('desde') ?? '/');
      router.refresh();
    } catch (e) {
      setErrorGeneral(mensajeDe(e));
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          // El teclado de iOS: sin esto sale el alfabético en un campo de email.
          inputMode="email"
          autoCapitalize="none"
          {...register('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="min-h-11 rounded-md border px-3"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="min-h-11 rounded-md border px-3"
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* aria-live: un lector de pantalla tiene que enterarse del fallo. */}
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-600">
        {errorGeneral}
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        // 44px de alto mínimo: §7 lo exige para el pulgar.
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
