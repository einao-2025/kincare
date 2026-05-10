import { Module } from '@nestjs/common';
import { SmartController } from './smart.controller';
import { SmartService } from './smart.service';
import { OAuthRegistrationController } from './registration.controller';

/**
 * SMART-on-FHIR App Launch (v2) + dynamic OAuth2 client registration.
 * Endpoints (all under root `/`):
 *   GET  /.well-known/smart-configuration
 *   POST /oauth/register                  (RFC 7591, gated by REGISTRATION_INITIAL_TOKEN)
 *   GET  /oauth/authorize                 (returns 302 to consent UI when interactive)
 *   POST /oauth/authorize/consent         (consent UI submits here; issues code)
 *   POST /oauth/token                     (PKCE / client_secret_basic)
 *
 * The authorisation server purposely does not run inside the global `api/v1`
 * prefix — SMART discovery URLs are well-known absolutes.
 */
@Module({
  controllers: [SmartController, OAuthRegistrationController],
  providers: [SmartService],
  exports: [SmartService],
})
export class SmartModule {}
