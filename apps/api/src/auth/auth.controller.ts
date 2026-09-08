import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, type SessionUser } from './auth.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './dto.js';
import { Public } from './public.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from './cookies.js';
import type { Session } from './auth.service.js';

function clientContext(req: Request): { userAgent?: string; ip?: string } {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

function respondWithSession(res: Response, session: Session): { user: SessionUser } {
  setSessionCookies(res, {
    accessToken: session.accessToken,
    refreshToken: session.refresh.raw,
    refreshExpiresAt: session.refresh.expiresAt,
  });
  // El access token también en el body para clientes no-navegador (bot, CLI).
  res.setHeader('x-access-token', session.accessToken);
  return { user: session.user };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodBody(registerSchema)) dto: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser; accessToken: string }> {
    const session = await this.auth.register(dto, clientContext(req));
    respondWithSession(res, session);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodBody(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser; accessToken: string }> {
    const session = await this.auth.login(dto, clientContext(req));
    respondWithSession(res, session);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser; accessToken: string }> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const session = await this.auth.refresh(raw, clientContext(req));
    respondWithSession(res, session);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(raw);
    clearSessionCookies(res);
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string): Promise<SessionUser> {
    return this.auth.me(userId);
  }
}
