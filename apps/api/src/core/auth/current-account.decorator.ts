import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { Account } from '@nid/db';

export const CurrentAccount = createParamDecorator((_data: unknown, ctx: ExecutionContext): Account => {
  const request = ctx.switchToHttp().getRequest<Request & { account?: Account }>();
  if (!request.account) {
    throw new InternalServerErrorException(
      '@CurrentAccount() used on a route without AccountSessionGuard — add @UseGuards(AccountSessionGuard).',
    );
  }
  return request.account;
});

/** The OptionalAccountSessionGuard counterpart — undefined for an anonymous viewer, never a thrown error. */
export const CurrentAccountOptional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Account | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { account?: Account }>();
    return request.account;
  },
);

/** The current request's session token hash, set by AccountSessionGuard — for a "log out this device" route. */
export const CurrentSessionTokenHash = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { sessionTokenHash?: string }>();
  if (!request.sessionTokenHash) {
    throw new InternalServerErrorException(
      '@CurrentSessionTokenHash() used on a route without AccountSessionGuard — add @UseGuards(AccountSessionGuard).',
    );
  }
  return request.sessionTokenHash;
});
