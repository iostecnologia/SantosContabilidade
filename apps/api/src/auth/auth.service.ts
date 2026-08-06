import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AccessTokenPayload, RefreshTokenPayload } from "./interfaces/jwt-payload.interface";

type Tx = Prisma.TransactionClient;

interface TokenSubject {
  id: string;
  organizationId: string;
  email: string;
  securityStamp: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Todos os métodos aqui rodam FORA do TenancyInterceptor (rotas @Public()):
 * ainda não existe usuário autenticado quando alguém se registra, loga ou
 * troca um refresh token. Cada método abre e gerencia sua própria transação
 * diretamente no PrismaService (papel app_user), definindo
 * `app.current_org_id` manualmente assim que o tenant é conhecido — nunca
 * antes disso, para que RLS continue valendo mesmo aqui.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto) {
    const orgId = uuidv7();
    const adminUserId = uuidv7();
    const adminRoleId = uuidv7();
    const passwordHash = await argon2.hash(dto.adminPassword);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;

        await tx.organization.create({
          data: {
            id: orgId,
            slug: dto.organizationSlug,
            name: dto.organizationName,
            taxId: dto.organizationTaxId,
          },
        });

        await tx.user.create({
          data: {
            id: adminUserId,
            organizationId: orgId,
            email: dto.adminEmail,
            passwordHash,
            fullName: dto.adminFullName,
          },
        });

        await tx.role.create({
          data: { id: adminRoleId, organizationId: orgId, name: "Administrador", isSystem: true },
        });

        const allPermissions = await tx.permission.findMany({ select: { id: true, key: true } });
        if (allPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: allPermissions.map((p) => ({ organizationId: orgId, roleId: adminRoleId, permissionId: p.id })),
          });
        }

        await tx.userRole.create({ data: { organizationId: orgId, userId: adminUserId, roleId: adminRoleId } });

        await tx.sequenceCounter.create({
          data: { organizationId: orgId, counterKey: "journal_entry", currentValue: 0 },
        });

        const tokens = await this.issueTokenPair(
          tx,
          { id: adminUserId, organizationId: orgId, email: dto.adminEmail, securityStamp: 0 },
          allPermissions.map((p) => p.key),
        );

        return {
          organization: { id: orgId, slug: dto.organizationSlug, name: dto.organizationName },
          user: { id: adminUserId, email: dto.adminEmail, fullName: dto.adminFullName },
          ...tokens,
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Slug ou CNPJ já utilizado por outra organização.");
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({ where: { slug: dto.organizationSlug } });
      if (!org || !org.isActive) {
        throw new UnauthorizedException("Credenciais inválidas.");
      }

      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

      const user = await tx.user.findFirst({ where: { organizationId: org.id, email: dto.email } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("Credenciais inválidas.");
      }

      const valid = await argon2.verify(user.passwordHash, dto.password);
      if (!valid) {
        throw new UnauthorizedException("Credenciais inválidas.");
      }

      const permissions = await this.loadPermissionKeys(tx, org.id, user.id);
      const tokens = await this.issueTokenPair(tx, user, permissions);

      return { organization: { id: org.id, slug: org.slug, name: org.name }, ...tokens };
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${payload.organizationId}, true)`;

      const row = await tx.refreshToken.findUnique({ where: { id: payload.jti } });
      if (!row || row.userId !== payload.sub) {
        throw new UnauthorizedException("Refresh token inválido.");
      }

      if (row.revokedAt) {
        // Token já rotacionado sendo reapresentado: possível vazamento — derruba a família inteira.
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException("Refresh token reutilizado; sessão revogada por segurança.");
      }

      if (row.tokenHash !== sha256(dto.refreshToken) || row.expiresAt < new Date()) {
        throw new UnauthorizedException("Refresh token inválido ou expirado.");
      }

      const user = await tx.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("Usuário inativo.");
      }

      const newRowId = uuidv7();
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), replacedById: newRowId },
      });

      const permissions = await this.loadPermissionKeys(tx, payload.organizationId, user.id);
      return this.issueTokenPair(tx, user, permissions, row.familyId, newRowId);
    });
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(dto.refreshToken);
    } catch {
      return; // token já inválido/expirado — nada a revogar, operação idempotente.
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${payload.organizationId}, true)`;
      await tx.refreshToken.updateMany({
        where: { familyId: payload.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido ou expirado.");
    }
  }

  private async loadPermissionKeys(tx: Tx, organizationId: string, userId: string): Promise<string[]> {
    const userRoles = await tx.userRole.findMany({
      where: { organizationId, userId },
      select: {
        role: {
          select: { rolePermissions: { select: { permission: { select: { key: true } } } } },
        },
      },
    });

    const keys = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        keys.add(rp.permission.key);
      }
    }
    return Array.from(keys);
  }

  private async issueTokenPair(
    tx: Tx,
    user: TokenSubject,
    permissions: string[],
    familyId: string = uuidv7(),
    refreshRowId: string = uuidv7(),
  ) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      permissions,
      securityStamp: user.securityStamp,
    };
    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL") ?? "15m";
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessTtl,
    });

    const refreshTtlDays = Number(this.config.get<string>("JWT_REFRESH_TTL_DAYS") ?? 7);
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      familyId,
      jti: refreshRowId,
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: `${refreshTtlDays}d`,
    });

    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    await tx.refreshToken.create({
      data: {
        id: refreshRowId,
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, accessTokenExpiresIn: accessTtl };
  }
}
