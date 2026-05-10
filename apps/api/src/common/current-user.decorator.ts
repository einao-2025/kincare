import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '@kincare/shared';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthPrincipal;
  },
);
