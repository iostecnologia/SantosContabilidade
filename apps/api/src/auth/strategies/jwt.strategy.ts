import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { AccessTokenPayload } from "../interfaces/jwt-payload.interface";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";

/**
 * Roda durante o Guard, ANTES do TenancyInterceptor abrir a transação da
 * requisição. Por isso define seu próprio contexto de tenant, numa
 * transação curta e isolada, só para confirmar que o usuário ainda existe,
 * está ativo e que o `securityStamp` do token bate com o do banco (permite
 * revogar acesso quase-imediatamente quando papéis/permissões mudam, sem
 * precisar de sessão stateful).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${payload.organizationId}, true)`;
      return tx.user.findUnique({ where: { id: payload.sub } });
    });

    if (!user || !user.isActive || user.organizationId !== payload.organizationId) {
      throw new UnauthorizedException();
    }
    if (user.securityStamp !== payload.securityStamp) {
      throw new UnauthorizedException("Sessão expirada por alteração de permissões; faça login novamente.");
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      permissions: payload.permissions,
      securityStamp: user.securityStamp,
    };
  }
}
