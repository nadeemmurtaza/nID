import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedActor } from './types';

/**
 * Reads the actor TenantActorGuard attached to the request — the
 * actor-aware counterpart to CurrentTenant(), for the handful of routes
 * a human in apps/dashboard calls directly. Throws rather than returning
 * undefined if used on a route not behind TenantActorGuard, same reasoning
 * as CurrentTenant's own comment.
 */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedActor => {
  const request = ctx.switchToHttp().getRequest<Request & { actor?: AuthenticatedActor }>();
  if (!request.actor) {
    throw new InternalServerErrorException(
      '@CurrentActor() used on a route without TenantActorGuard — add @UseGuards(TenantActorGuard).',
    );
  }
  return request.actor;
});
