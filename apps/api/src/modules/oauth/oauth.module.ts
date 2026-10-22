import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [AccountsModule],
  controllers: [OAuthController],
  providers: [OAuthService],
})
export class OAuthModule {}
