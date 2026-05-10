import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import {
  LoginDto, MfaEnableConfirmDto, RefreshDto, RegisterDto,
} from './dto';
import { Audit, Public } from '../../common/decorators';
import { CurrentUser } from '../../common/current-user.decorator';
import { LoginThrottlerGuard } from '../../common/guards/login-throttler.guard';
import type { AuthPrincipal } from '@kincare/shared';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Audit({ action: 'CREATE', resourceType: 'User' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, { ip: req.ip, ua: req.headers['user-agent'] });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { ip: req.ip, ua: req.headers['user-agent'] });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, { ip: req.ip, ua: req.headers['user-agent'] });
  }

  /**
   * Lightweight endpoint for SPA clients to prime the CSRF cookie before
   * issuing their first unsafe (POST/PUT/PATCH/DELETE) request. The CSRF
   * middleware mints and sets the `csrf_token` cookie on any safe-method,
   * non-exempt request — this endpoint exists solely as a guaranteed target.
   */
  @Public()
  @Get('csrf')
  @HttpCode(204)
  csrf() {
    return;
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: AuthPrincipal) {
    return this.auth.logout(user.userId, user.sessionId);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthPrincipal) {
    return this.auth.listSessions(user.userId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.auth.revokeSession(user.userId, id);
  }

  // ── MFA ────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Post('mfa/setup')
  mfaBegin(@CurrentUser() user: AuthPrincipal) {
    return this.mfa.setupBegin(user.userId);
  }

  @ApiBearerAuth()
  @Post('mfa/confirm')
  mfaConfirm(@CurrentUser() user: AuthPrincipal, @Body() dto: MfaEnableConfirmDto) {
    return this.mfa.setupConfirm(user.userId, dto.code);
  }

  @ApiBearerAuth()
  @Delete('mfa')
  @HttpCode(204)
  mfaDisable(@CurrentUser() user: AuthPrincipal) {
    return this.mfa.disable(user.userId);
  }
}
