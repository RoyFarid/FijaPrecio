import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma, MembershipRole } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { slugify } from './slug.js';
import type { LoginInput, RegisterInput } from './dto.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
}

export interface Session {
  accessToken: string;
  refresh: { raw: string; expiresAt: Date };
  user: SessionUser;
}

interface ClientContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput, ctx: ClientContext): Promise<Session> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ese email ya está registrado');

    const freePlan = await this.prisma.client.plan.findUnique({
      where: { code: 'FREE' },
      select: { id: true },
    });

    const passwordHash = await this.passwords.hash(input.password);

    const { user, membership } = await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: input.name, passwordHash, locale: 'es-PE' },
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: await this.uniqueSlug(tx, slugify(input.organizationName)),
        },
      });

      const membership = await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: 'OWNER' },
        include: { organization: { select: { id: true, name: true } } },
      });

      if (freePlan) {
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: freePlan.id,
            status: 'ACTIVE',
          },
        });
      }

      return { user, membership };
    });

    return this.issueSession(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        role: membership.role,
      },
      ctx,
    );
  }

  async login(input: LoginInput, ctx: ClientContext): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });

    const ok =
      user?.passwordHash != null &&
      (await this.passwords.verify(user.passwordHash, input.password));
    if (!user || !ok) throw new UnauthorizedException('Credenciales inválidas');

    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException('El usuario no tiene una organización activa');

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        role: membership.role,
      },
      ctx,
    );
  }

  async refresh(rawToken: string | undefined, ctx: ClientContext): Promise<Session> {
    if (!rawToken) throw new UnauthorizedException('Falta el refresh token');

    const rotated = await this.tokens.rotateRefreshToken(rawToken, ctx);
    const user = await this.loadSessionUser(rotated.userId);

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      org: user.organizationId,
      role: user.role,
    });

    return {
      accessToken,
      refresh: { raw: rotated.raw, expiresAt: rotated.expiresAt },
      user,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.tokens.revokeByRaw(rawToken);
  }

  async me(userId: string): Promise<SessionUser> {
    return this.loadSessionUser(userId);
  }

  // ---------------------------------------------------------------------------

  private async issueSession(user: SessionUser, ctx: ClientContext): Promise<Session> {
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      org: user.organizationId,
      role: user.role,
    });
    const refresh = await this.tokens.issueRefreshToken({ userId: user.id, ctx });
    return { accessToken, refresh: { raw: refresh.raw, expiresAt: refresh.expiresAt }, user };
  }

  private async loadSessionUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });
    const membership = user?.memberships[0];
    if (!user || !membership) throw new UnauthorizedException('Sesión inválida');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      role: membership.role,
    };
  }

  private async uniqueSlug(
    tx: Prisma.TransactionClient,
    base: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
      const taken = await tx.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 12)}`;
  }
}
