import {
  Body, Controller, Get, Post, Query, Req, Res, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators';
import { SmartService } from './smart.service';

@Controller()
export class SmartController {
  constructor(private readonly smart: SmartService) {}

  /** SMART discovery — must be reachable without auth at the well-known URL. */
  @Public()
  @Get('.well-known/smart-configuration')
  wellKnown(@Req() req: Request) {
    const base = `${req.protocol}://${req.get('host')}`;
    return this.smart.buildWellKnown(base);
  }

  /**
   * Authorisation request. In a real deployment this redirects the browser to
   * the consent UI; here we return a JSON shape the SPA renders inline.
   * The SPA submits to /oauth/authorize/consent once the user agrees.
   */
  @Public()
  @Get('oauth/authorize')
  async authorize(@Query() query: Record<string, string>) {
    return this.smart.beginAuthorize(query);
  }

  /**
   * Consent callback. The authenticated patient confirms the requested scopes
   * and the endpoint issues a one-time `code` returned via the registered
   * `redirect_uri`.
   */
  @Post('oauth/authorize/consent')
  async consent(
    @Req() req: Request & { user?: { sub: string } },
    @Body() body: {
      clientDbId: string;
      redirectUri: string;
      scope: string;
      state?: string;
      patientId?: string;
      encounterId?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    },
    @Res() res: Response,
  ) {
    if (!req.user?.sub) throw new UnauthorizedException('Authenticate first');
    const code = await this.smart.issueAuthCode({ ...body, userId: req.user.sub });
    const url = new URL(body.redirectUri);
    url.searchParams.set('code', code);
    if (body.state) url.searchParams.set('state', body.state);
    res.redirect(302, url.toString());
  }

  /** Token exchange (PKCE or client_secret_basic). */
  @Public()
  @Post('oauth/token')
  async token(@Req() req: Request, @Body() body: Record<string, string>) {
    const auth = req.headers.authorization;
    let basic: { id: string; secret: string } | undefined;
    if (auth?.toLowerCase().startsWith('basic ')) {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx > 0) basic = { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
    }
    return this.smart.exchangeCode(body, basic);
  }
}
