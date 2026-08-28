import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type UsuarioActual } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService, type Tokens } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Devuelve los tokens EN EL CUERPO, no en una cookie: el navegador nunca habla
   * con esta API, lo hace la pasarela de Next, que los guarda en su propia cookie
   * httpOnly del dominio del admin. Enmienda a §16, ver CLAUDE.md.
   */
  @Public()
  // Un admin de un solo usuario sin límite de intentos es fuerza bruta esperando (§16).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string): Promise<Tokens> {
    return this.auth.login(dto.email, dto.password, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<Tokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Body() dto: RefreshDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() usuario: UsuarioActual) {
    // `select` explícito, no @Exclude(): omitir un campo aquí falla cerrado.
    return this.prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
