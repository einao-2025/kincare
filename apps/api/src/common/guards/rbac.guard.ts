import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal, Permission, Role } from '@kincare/shared';
import { PERMS_KEY, ROLES_KEY } from '../decorators';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    const requiredPerms = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMS_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!requiredRoles?.length && !requiredPerms?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthPrincipal | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Role ${user.role} is not permitted`);
    }
    if (requiredPerms?.length) {
      const has = requiredPerms.every((p) => user.permissions.includes(p));
      if (!has) throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
