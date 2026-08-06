import { CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { from, Observable, firstValueFrom } from "rxjs";
import { TransactionHost } from "@nestjs-cls/transactional";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import { PrismaTransactionAdapter } from "./tenancy.module";

/**
 * Abre uma transação interativa do Prisma por requisição e define o
 * contexto de tenant (`app.current_org_id`) como primeira instrução dessa
 * transação, ANTES de qualquer query do handler rodar. É isso que faz as
 * policies de Row-Level Security do Postgres valerem de verdade: `SET
 * LOCAL`/`set_config(..., true)` só tem efeito dentro da conexão/transação
 * corrente, então tudo que a requisição faz precisa acontecer na mesma
 * transação — nunca abra uma segunda query fora dela para dados de tenant.
 *
 * Rotas marcadas com @Public() (registro de organização, login, refresh)
 * pulam este interceptor inteiramente: elas ainda não têm um usuário
 * autenticado/organização conhecida, e gerenciam sua própria transação de
 * bootstrapping no serviço (ver AuthService).
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.organizationId) {
      throw new UnauthorizedException("Contexto de organização ausente.");
    }

    return from(
      this.txHost.withTransaction(async () => {
        const tx = this.txHost.tx;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${user.organizationId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
        return firstValueFrom(next.handle());
      }),
    );
  }
}
