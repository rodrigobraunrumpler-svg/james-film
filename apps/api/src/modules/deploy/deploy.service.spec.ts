import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBOUNCE_MS, DeployService } from './deploy.service.js';

const HOOK = 'https://api.cloudflare.com/hook/xyz';

/**
 * Los servicios se construyen a mano: sin contenedor de Nest y sin base.
 *
 * `null` y no `undefined` para el caso «sin hook»: pasar `undefined` activaría
 * el valor por defecto del parámetro y el test probaría lo contrario de lo que
 * dice su nombre. Pasó.
 */
function crear(hook: string | null = HOOK) {
  const deployState = {
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  };
  const prisma = { deployState } as never;
  const config = { get: vi.fn().mockReturnValue(hook ?? undefined) } as never;
  return { servicio: new DeployService(prisma, config), deployState };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DeployService', () => {
  it('un cambio NO publica al instante: espera el debounce', async () => {
    const { servicio } = crear();

    await servicio.marcarCambio();

    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('diez cambios seguidos son UN solo build, no diez', async () => {
    // Es la razón de ser del debounce, y por la que la API necesita un proceso
    // vivo: en serverless este temporizador no existiría.
    const { servicio } = crear();

    for (let i = 0; i < 10; i++) {
      await servicio.marcarCambio();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2);
    }
    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('cada cambio incrementa el contador que ve James', async () => {
    const { servicio, deployState } = crear();

    await servicio.marcarCambio();
    await servicio.marcarCambio();

    expect(deployState.upsert).toHaveBeenCalledTimes(2);
    expect(deployState.upsert.mock.calls[0][0]).toMatchObject({
      update: { pendingChanges: { increment: 1 }, status: 'QUEUED' },
    });
  });

  it('al publicar, el contador vuelve a cero', async () => {
    const { servicio, deployState } = crear();

    await servicio.marcarCambio();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(deployState.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingChanges: 0, status: 'SUCCESS' }) }),
    );
  });

  it('si el hook falla, los cambios NO se dan por publicados', async () => {
    // Ponerlos a cero perdería de vista que la web sigue con lo de antes, que
    // es justo lo que el aviso del panel tiene que poder decir.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { servicio, deployState } = crear();

    await servicio.marcarCambio();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    const datos = deployState.update.mock.calls.at(-1)?.[0].data;
    expect(datos.status).toBe('FAILED');
    expect(datos.pendingChanges).toBeUndefined();
    expect(datos.error).toContain('500');
  });

  it('una red caída tampoco pierde los cambios', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { servicio, deployState } = crear();

    await servicio.marcarCambio();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(deployState.update.mock.calls.at(-1)?.[0].data.status).toBe('FAILED');
  });

  it('sin DEPLOY_HOOK_URL no llama a nadie ni marca error', async () => {
    // Es el caso de local y CI: cada guardado en desarrollo NO debe disparar un
    // build de producción, y tampoco debe parecer que algo se rompió.
    const { servicio, deployState } = crear(null);

    await servicio.marcarCambio();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(fetch).not.toHaveBeenCalled();
    expect(deployState.update).not.toHaveBeenCalled();
  });

  it('publicar() a mano se salta el debounce y cancela el pendiente', async () => {
    // El botón del panel: si James lo pulsa es que ya terminó. Y sin cancelar,
    // el temporizador dispararía un segundo build 60 s después.
    const { servicio } = crear();

    await servicio.marcarCambio();
    await servicio.publicar();
    expect(fetch).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('al apagarse no deja el temporizador colgando', async () => {
    const { servicio } = crear();

    await servicio.marcarCambio();
    servicio.onModuleDestroy();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(fetch).not.toHaveBeenCalled();
  });
});
