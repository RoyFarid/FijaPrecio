import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MembershipRole } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { env } from '../config/env.js';
import { durationToMs } from '../common/duration.js';

export interface AccessTokenClaims {
  sub: string; // userId
  org: string; // organizationId activa
  role: MembershipRole;
}

interface RefreshContext {
  userAgent?: string;
  ip?: string;
}

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const expiresIn = Math.floor(durationToMs(env.JWT_ACCESS_TTL) / 1000);
    return this.jwt.signAsync(claims, { expiresIn });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      return await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /** Crea un refresh token nuevo (login) o continúa una familia (rotación). */
  async issueRefreshToken(args: {
    userId: string;
    family?: string;
    ctx?: RefreshContext;
  }): Promise<{ raw: string; id: string; expiresAt: Date }> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_TTL));

    const created = await this.prisma.client.refreshToken.create({
      data: {
        userId: args.userId,
        tokenHash: sha256(raw),
        family: args.family ?? randomUUID(),
        userAgent: args.ctx?.userAgent?.slice(0, 400),
        ip: args.ctx?.ip,
        expiresAt,
      },
      select: { id: true },
    });

    return { raw, id: created.id, expiresAt };
  }

  /**
   * Valida el refresh token entrante y lo rota.
   * Detección de reuso: si llega un token ya revocado, se revoca toda la familia
   * (señal de robo) y se rechaza.
   */
  async rotateRefreshToken(
    raw: string,
    ctx?: RefreshContext,
  ): Promise<{ userId: string; raw: string; expiresAt: Date }> {
    const current = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });

    if (!current || current.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    if (current.revokedAt) {
      await this.revokeFamily(current.family);
      throw new UnauthorizedException('Sesión revocada');
    }

    const next = await this.issueRefreshToken({
      userId: current.userId,
      family: current.family,
      ctx,
    });

    await this.prisma.client.refreshToken.update({
      where: { id: current.id },
      data: { revokedAt: new Date(), replacedById: next.id },
    });

    return { userId: current.userId, raw: next.raw, expiresAt: next.expiresAt };
  }

  async revokeByRaw(raw: string): Promise<void> {
    const token = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      select: { family: true },
    });
    if (token) await this.revokeFamily(token.family);
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
