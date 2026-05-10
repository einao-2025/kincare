import {
  Body, Controller, Headers, Post, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators';
import { SmartService } from './smart.service';

/**
 * RFC 7591 Dynamic Client Registration. Gated by an initial-access token
 * (`SMART_REGISTRATION_TOKEN`) so an open endpoint isn't exposed by default.
 * Set the env var to a strong secret and share it with partners during
 * onboarding; rotate per integration.
 */
@Controller('oauth/register')
export class OAuthRegistrationController {
  constructor(
    private readonly smart: SmartService,
    private readonly cfg: ConfigService,
  ) {}

  @Public()
  @Post()
  async register(
    @Headers('authorization') auth: string | undefined,
    @Body() body: {
      client_name: string;
      redirect_uris: string[];
      scope?: string;
      token_endpoint_auth_method?: 'client_secret_basic' | 'none';
      jwks_uri?: string;
      tenantId?: string;
    },
  ) {
    const expected = this.cfg.get<string>('SMART_REGISTRATION_TOKEN');
    if (!expected) throw new UnauthorizedException('Dynamic registration disabled');
    if (!auth?.startsWith('Bearer ') || auth.slice(7) !== expected) {
      throw new UnauthorizedException('Invalid initial access token');
    }
    return this.smart.register(body);
  }
}
