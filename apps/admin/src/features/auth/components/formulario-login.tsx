'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { clasesBoton } from '@/components/shared/boton';
import { useCuentaAtras } from '../hooks/use-cuenta-atras';
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

/**
 * Sin caja: el campo es una línea base que se dibuja al enfocar. Menos borde y
 * un foco más inequívoco — y en error la MISMA línea se tiñe, así que el estado
 * se lee sin añadir un segundo elemento.
 *
 * `box-shadow` y no `border-bottom`: un borde ocupa sitio y al aparecer movería
 * el campo un píxel; la sombra interior no toca el layout.
 */
const CAMPO =
  'peer min-h-11 w-full border-0 bg-transparent px-0 pt-0 pb-1 text-[15px] text-bone outline-none ' +
  'shadow-[inset_0_-1px_0_0_var(--color-line-strong)] hover:shadow-[inset_0_-1px_0_0_var(--color-line-hover)] ' +
  'aria-invalid:shadow-[inset_0_-1px_0_0_var(--color-danger-line)]';

/** Crece desde la izquierda con `scaleX`: no toca el layout. */
const LINEA =
  'bg-brass peer-aria-invalid:bg-danger pointer-events-none absolute inset-x-0 bottom-0 h-0.5 ' +
  'origin-left scale-x-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] ' +
  'peer-focus-visible:scale-x-100 motion-reduce:peer-focus-visible:scale-x-100';

const ETIQUETA =
  'text-ash text-xs font-medium tracking-[0.14em] uppercase transition-colors duration-150 ' +
  'group-focus-within:text-brass';

export function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const clave = useRef<HTMLInputElement | null>(null);
  const [espera, setEspera] = useState<number | undefined>();
  const restante = useCuentaAtras(espera);

  /**
   * NO se precarga el destino. Se hacía —«el panel se precarga mientras
   * escribe»— y **envenenaba la caché del router**: sin sesión, `/` responde
   * 307 a `/login?desde=/`, y eso es lo que quedaba cacheado. Después de
   * acertar la contraseña, `router.replace('/')` reusaba esa entrada y volvía
   * al login con la sesión ya creada, en bucle.
   *
   * Y no precargaba nada útil: la respuesta que cacheaba era la redirección,
   * no el panel. Era una carrera que se ganaba o se perdía según lo rápido que
   * llegara el 307.
   */

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosLogin>({ resolver: zodResolver(esquemaLogin) });

  // `register` devuelve su propia ref; para poder seleccionar el campo al
  // fallar hay que encadenar la nuestra en vez de sustituirla.
  const campoClave = register('password');

  // Por qué está en esta pantalla. Sin esto, a James le echa la sesión y
  // aterriza en el login sin saber si se equivocó o si se cayó algo.
  const motivo = params.get('motivo');
  const aviso =
    errorGeneral ??
    (motivo === 'revocada'
      ? 'Cerramos tu sesión por seguridad. Vuelve a entrar.'
      : motivo === 'caducada'
        ? 'Tu sesión caducó. Vuelve a entrar.'
        : null);

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    try {
      await iniciarSesion(datos);
      // `refresh()` ANTES del `replace()`: invalida la caché del router, que
      // todavía guarda las respuestas de cuando no había sesión. Al revés,
      // navega primero y limpia después — o sea, navega con lo viejo.
      router.refresh();
      // `desde` lo pone proxy.ts al redirigir: se vuelve a donde iba.
      router.replace(params.get('desde') ?? '/');
    } catch (e) {
      setErrorGeneral(mensajeDe(e));
      if (e instanceof ErrorLogin && e.code === 'RATE_LIMITED') setEspera(e.esperaSegundos);
      // El foco vuelve al campo que hay que corregir, con el texto marcado
      // para escribir encima. Sin esto James tiene que buscar el campo, borrar
      // y volver a escribir — tres gestos de más justo cuando ya ha fallado.
      clave.current?.focus();
      clave.current?.select();
    }
  });

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="flex max-w-[340px] flex-col gap-5.5 lg:max-w-none lg:pl-14 xl:pl-20"
    >
      <div className="entra group flex flex-col gap-1" style={{ '--i': 4 } as React.CSSProperties}>
        <label htmlFor="email" className={ETIQUETA}>
          Email
        </label>
        <span className="relative block">
          <input
            id="email"
            type="email"
            autoComplete="username"
            // El teclado de iOS: sin esto sale el alfabético, y con mayúscula
            // automática, en un campo de email.
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            // Es el primer campo de la única pantalla: se puede escribir nada
            // más abrir, sin apuntar con el ratón.
            autoFocus
            {...register('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={CAMPO}
          />
          <span aria-hidden className={LINEA} />
        </span>
        {errors.email && (
          <p id="email-error" role="alert" className="text-danger text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="entra group flex flex-col gap-1" style={{ '--i': 5 } as React.CSSProperties}>
        <label htmlFor="password" className={ETIQUETA}>
          Contraseña
        </label>
        <span className="relative block">
          <input
            id="password"
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            {...campoClave}
            ref={(el) => {
              campoClave.ref(el);
              clave.current = el;
            }}
            // `getModifierState` en cada tecla: no hay evento de Bloq Mayús, y
            // `FocusEvent` no lo expone —solo los de teclado—, así que el aviso
            // aparece con la primera tecla y no antes.
            onKeyUp={(e) => setMayusculas(e.getModifierState('CapsLock'))}
            onBlur={(e) => {
              // El `onBlur` de react-hook-form es asíncrono: se encadena, no se
              // sustituye, o el campo deja de validarse al salir de él.
              void campoClave.onBlur(e);
              setMayusculas(false);
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              [errors.password && 'password-error', mayusculas && 'password-mayusculas']
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`${CAMPO} pr-11`}
          />
          <span aria-hidden className={LINEA} />
          {/* Escribir una contraseña a ciegas, de noche y en un móvil es donde
              más se falla. El botón no entra en el tabulador antes que el de
              enviar: va después, porque enviar es lo que se quiere hacer. */}
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-pressed={verClave}
            aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            className="text-muted hover:text-ash absolute right-0 bottom-1 flex size-11 items-center justify-center transition-colors duration-150"
          >
            {verClave ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </span>
        {mayusculas && (
          <p id="password-mayusculas" className="text-ash text-sm">
            Tienes Bloq Mayús activado.
          </p>
        )}
        {errors.password && (
          <p id="password-error" role="alert" className="text-danger text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="entra flex flex-col gap-3.5" style={{ '--i': 6 } as React.CSSProperties}>
        {/* aria-live en el elemento VISIBLE, no en una copia `sr-only`: con dos
            el mismo texto está dos veces en el DOM y nadie gana nada, porque la
            barrita decorativa ya lleva su propio `aria-hidden`.
            Se pinta solo si hay algo — un hueco reservado con `min-h` dejaba un
            espacio muerto entre el campo y el botón. */}
        {aviso && (
          <p
            role="alert"
            aria-live="polite"
            className={
              errorGeneral
                ? 'border-danger-line bg-danger-bg text-danger rounded-control flex gap-2 border px-3 py-2.5 text-sm'
                : 'border-line-strong bg-card text-ash rounded-control flex gap-2 border px-3 py-2.5 text-sm'
            }
          >
            {/* El motivo de sesión NO es un error de James: se cuenta en tono
                neutro. Pintarlo en rojo le haría buscar qué hizo mal. */}
            <span
              aria-hidden
              className={`w-0.5 shrink-0 self-stretch rounded-[2px] ${errorGeneral ? 'bg-danger' : 'bg-line-hover'}`}
            />
            {restante > 0 ? `${aviso} Puedes volver a probar en ${restante} s.` : aviso}
          </p>
        )}

        <button
          type="submit"
          // Bloqueado mientras dura el castigo: dejar pulsar solo consigue que
          // el throttler reinicie la ventana y James espere más.
          disabled={isSubmitting || restante > 0}
          aria-busy={isSubmitting}
          className={clasesBoton(
            'principal',
            'entrar group h-13 w-full text-base font-semibold tracking-[0.02em] lg:min-h-13',
          )}
        >
          {isSubmitting ? (
            <>
              {/* El punto latiendo dice «está pasando algo» sin un spinner que
                  gire en bucle: es `opacity`, no un repintado por fotograma. */}
              <span className="bg-brass size-1.5 animate-pulse rounded-full" aria-hidden />
              Entrando…
            </>
          ) : restante > 0 ? (
            `Espera ${restante} s`
          ) : (
            <>
              Entrar
              {/* La flecha se adelanta al pasar por encima: dice hacia dónde
                  lleva el botón. Solo `transform`. */}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
