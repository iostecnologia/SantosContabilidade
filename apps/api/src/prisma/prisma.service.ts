import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Client de runtime, conectado como `app_user` (papel restrito por RLS —
 * ver DATABASE_URL). Nunca usar diretamente para dados de tenant fora do
 * bootstrapping (registro de organização, login) — nesses casos, use
 * TransactionHost<TransactionalAdapterPrisma> para obter o client
 * transacional vinculado ao contexto da requisição (ver tenancy/).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
