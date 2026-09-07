import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * La sonda que decide si un despliegue SALE o se queda parado.
 *
 * Sin ella, Railway promociona la versión nueva en cuanto el puerto acepta
 * conexiones y retira la vieja. Con ella, **la vieja sigue sirviendo mientras
 * la nueva no conteste 200**. Y eso importa aquí más que en otros sitios: el
 * esquema Zod hace que la app **no arranque** si falta una variable, así que un
 * despliegue con `WEB_ORIGIN` mal escrito tiene que quedarse detenido, no
 * tumbar la API.
 *
 * **Toca la BASE, no responde 200 a secas.** Una sonda que solo dice «el
 * proceso vive» cubre el arranque y nada más: a partir del segundo uno, con la
 * base caída la app seguiría contestando 200 sin poder servir una sola
 * consulta — que es exactamente lo que el health check existía para ver.
 *
 * `@Public()` porque la sonda no tiene sesión, y `@SkipThrottle()` porque el
 * límite global es de 120 por minuto y una sonda cada pocos segundos desde la
 * misma IP se lo comería, tumbando el despliegue por su propia vigilancia.
 *
 * Fuera de los dos Swagger: no es contrato de nadie, es plomería.
 */
@Public()
@SkipThrottle()
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async estado(): Promise<{
    estado: 'ok';
    arquitectura: string;
    plataforma: string;
    node: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      /**
       * 503 y no 500: es temporal por definición —el arranque en frío de la
       * base, un reinicio— y es lo que un health check tiene que leer como
       * «todavía no», no como «esto está roto». Es el mismo criterio que el
       * filtro de excepciones ya aplica a P1001, P1002 y P2024.
       */
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'La base de datos no responde todavía.',
        causa: e instanceof Error ? e.name : 'desconocida',
      });
    }

    /**
     * La arquitectura viaja en la respuesta a propósito.
     *
     * Railway no documenta si sus contenedores son amd64 o arm64, y de eso
     * depende que `@node-rs/argon2` cargue su binario correcto: si no coincide,
     * la API arranca, sirve las galerías y **muere en el primer login**. Aquí
     * se ve de un vistazo y sin entrar por SSH.
     */
    return {
      estado: 'ok',
      arquitectura: process.arch,
      plataforma: process.platform,
      node: process.versions.node,
    };
  }
}
