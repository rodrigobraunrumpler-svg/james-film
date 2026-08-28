import { ApiProperty } from '@nestjs/swagger';
import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export class TokensEntity {
  @ApiProperty({ description: 'JWT de 15 min. En memoria, nunca en localStorage.' })
  accessToken!: string;
  @ApiProperty({ description: '32 bytes en hex. En la base solo vive su SHA-256.' })
  refreshToken!: string;
}

export class UsuarioEntity {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ADMIN', 'EDITOR'] }) role!: 'ADMIN' | 'EDITOR';
}

export const DocLogin = (): MethodDecorator =>
  ApiDoc({
    summary: 'Inicia sesión',
    description:
      'Devuelve los tokens **en el cuerpo, no en una cookie**: el navegador nunca habla ' +
      'con esta API, lo hace la pasarela de Next, que los guarda en su propia cookie ' +
      '`httpOnly` del dominio del admin.',
    ok: TokensEntity,
    errors: [401, 422, 429],
  });

export const DocRefresh = (): MethodDecorator =>
  ApiDoc({
    summary: 'Rota el par de tokens',
    description:
      'Cada refresh emite uno nuevo e invalida el anterior. Presentar un token ya rotado ' +
      'dentro de la **ventana de gracia** se acepta —es una carrera legítima entre dos ' +
      'invocaciones de la pasarela, que en serverless no pueden coordinarse—; fuera de ' +
      'ella es señal de robo y **revoca la sesión entera** con `SESSION_REVOKED`.',
    ok: TokensEntity,
    errors: [401, 422],
  });

export const DocLogout = (): MethodDecorator =>
  ApiDoc({ summary: 'Revoca la sesión', status: 204, errors: [422] });

export const DocMe = (): MethodDecorator =>
  ApiDoc({ summary: 'Devuelve el usuario autenticado', ok: UsuarioEntity, auth: true });
