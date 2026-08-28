import { SetMetadata } from '@nestjs/common';

export const ROLES = 'roles';

export const Roles = (...roles: ('ADMIN' | 'EDITOR')[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES, roles);
