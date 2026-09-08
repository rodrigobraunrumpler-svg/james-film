import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * El debounce ES la razón por la que la API vive en Railway y no en Vercel: en
 * serverless cada invocación es un proceso nuevo y este temporizador no existe.
 * Editar diez campos seguidos dispararía diez builds de Astro.
 */
export const DEBOUNCE_MS = 60_000;

const SINGLETON = 'singleton';

/**
 * Lo que cierra el círculo «James edita → la web se actualiza».
 *
 * Sin esto el admin escribe en la base y la landing —que es **estática**— sigue
 * sirviendo el HTML del último build. No falla nada, no hay error en ninguna
 * parte, y desde el lado de James el panel parece roto.
 */
@Injectable()
export class DeployService implements OnModuleDestroy {
  private readonly log = new Logger(DeployService.name);
  private temporizador: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Una mutación del admin ocurrió. Cuenta el cambio y REARMA el temporizador:
   * es un debounce de verdad, no un intervalo. Editando sin parar no se publica
   * a medias — sale 60 s después del último cambio, que es cuando James ha
   * terminado.
   */
  async marcarCambio(): Promise<void> {
    await this.prisma.deployState.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, pendingChanges: 1, status: 'QUEUED' },
      update: { pendingChanges: { increment: 1 }, status: 'QUEUED' },
    });

    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.publicar(), DEBOUNCE_MS);
    // Que un temporizador pendiente no impida al proceso terminar: Railway manda
    // SIGTERM en cada redeploy y `enableShutdownHooks` espera a que cierre.
    this.temporizador.unref();
  }

  /**
   * Dispara el rebuild. Público porque el botón «Publicar los N cambios» del
   * panel se lo salta el debounce: cuando James lo pulsa es que ya terminó.
   *
   * **`SUCCESS` aquí significa «Cloudflare aceptó la petición», no «el build
   * salió bien»** — para eso haría falta consultar su API con un token, que es
   * otra pieza. Lo que sí cubre, que es lo que más duele, es el caso de no
   * haber podido ni pedirlo: eso queda en `FAILED` y el panel lo cuenta como
   * «la web sigue mostrando lo de antes».
   */
  async publicar(): Promise<void> {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }

    const url = this.config.get<string>('DEPLOY_HOOK_URL');
    if (!url) {
      // En local y en CI no hay hook, y está bien: no se avisa como error para
      // que el log de desarrollo no parezca roto en cada guardado.
      this.log.debug('Sin DEPLOY_HOOK_URL: no se reconstruye la web.');
      return;
    }

    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`el hook respondió ${res.status}`);

      await this.prisma.deployState.update({
        where: { id: SINGLETON },
        data: {
          pendingChanges: 0,
          status: 'SUCCESS',
          triggeredAt: new Date(),
          finishedAt: new Date(),
          error: null,
        },
      });
      this.log.log('Rebuild de la web solicitado.');
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'error desconocido';
      // NO se ponen los cambios a cero: siguen sin publicar, que es la verdad,
      // y así el siguiente intento los arrastra en vez de perderlos de vista.
      await this.prisma.deployState.update({
        where: { id: SINGLETON },
        data: { status: 'FAILED', finishedAt: new Date(), error: `No se pudo avisar a Cloudflare: ${motivo}` },
      });
      this.log.error(`No se pudo disparar el rebuild: ${motivo}`);
    }
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }
}
