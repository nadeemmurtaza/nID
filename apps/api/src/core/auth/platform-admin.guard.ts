import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { loadEnv } from '../config/env';

/**
 * Platform-admin guard: protects tenant creation and platform-level
 * tenant management endpoints. Checks a shared secret in the
 * Authorization header (Bearer <PLATFORM_ADMIN_SECRET>). This is the
 * only way to create a new tenant — no existing tenant context needed.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly secret: string;

  constructor() {
    this.secret = loadEnv().platformAdminSecret;
    if (!this.secret || this.secret.length < 32) {
      throw new Error(
        'PLATFORM_ADMIN_SECRET must be set to a random 32+ character string. ' +
          'Generate with: openssl rand -hex 32',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'];

    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedException('Missing platform admin secret.');
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.constantTimeCompare(token, this.secret)) {
      throw new UnauthorizedException('Invalid platform admin secret.');
    }

    // Mark the request as platform-admin authenticated
    (request as Request & { isPlatformAdmin: boolean }).isPlatformAdmin = true;
    return true;
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
