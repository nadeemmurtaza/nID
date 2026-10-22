import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccountSessionGuard } from '../../core/auth/account-session.guard';
import { CurrentAccount } from '../../core/auth/current-account.decorator';
import type { Account } from '@nid/db';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';
import { OAuthService } from './oauth.service';

@Controller('v1/oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /** apps/login-ui calls this to start a "Login with nID" attempt. */
  @Post('login-requests')
  create(@Body() dto: CreateLoginRequestDto) {
    return this.oauth.createLoginRequest(dto.clientId, dto.redirectUri, dto.state);
  }

  /** apps/login-ui polls this from the page that first opened /authorize. */
  @Get('login-requests/:pollToken')
  status(@Param('pollToken') pollToken: string) {
    return this.oauth.getStatus(pollToken);
  }

  /** apps/login-ui calls this once the visiting Account is authenticated — see oauth.service.ts on why this doesn't return a redirect target. */
  @UseGuards(AccountSessionGuard)
  @Post('login-requests/:pollToken/approve')
  approve(@Param('pollToken') pollToken: string, @CurrentAccount() account: Account) {
    return this.oauth.approve(pollToken, account);
  }

  /** apps/login-ui's polling tab calls this once status flips to APPROVED. */
  @Post('login-requests/:pollToken/claim')
  claim(@Param('pollToken') pollToken: string) {
    return this.oauth.claim(pollToken);
  }

  /** The relying party's own backend calls this — never the browser. */
  @Post('token')
  token(@Body() dto: TokenExchangeDto) {
    return this.oauth.exchangeToken(dto.code, dto.clientId, dto.clientSecret, dto.redirectUri);
  }
}
