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
