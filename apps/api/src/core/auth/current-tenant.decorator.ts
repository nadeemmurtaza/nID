import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedTenant } from './types';

/**
 * Reads the tenant ApiKeyGuard attached to the request. Throws rather than
 * returning undefined if used on a route not behind ApiKeyGuard — a silent
 * `undefined` tenant id is exactly the bug RLS is there to catch one layer
 * lower, but it should never get that far.
 */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedTenant => {
  const request = ctx.switchToHttp().getRequest<Request & { tenant?: AuthenticatedTenant }>();
  if (!request.tenant) {
    throw new InternalServerErrorException(
      '@CurrentTenant() used on a route without ApiKeyGuard — add @UseGuards(ApiKeyGuard).',
    );
  }
  return request.tenant;
});
