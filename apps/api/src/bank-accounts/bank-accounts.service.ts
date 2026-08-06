import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

/**
 * A validação de que a conta contábil é analítica/ativa é garantida de
 * verdade pelo trigger de linhas de lançamento (ver
 * prisma/migrations/20260806000001_rls_and_triggers/migration.sql) no
 * momento em que um pagamento/recebimento realmente posta nela. A checagem
 * aqui existe só para devolver um erro amigável antes do round-trip.
 */
@Injectable()
export class BankAccountsService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.bankAccount.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  }

  async create(organizationId: string, dto: CreateBankAccountDto) {
    await this.ensureGlAccountUsable(organizationId, dto.glAccountId);
    return this.tx.bankAccount.create({
      data: {
        organizationId,
        kind: dto.kind,
        name: dto.name,
        bankCode: dto.bankCode,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        glAccountId: dto.glAccountId,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateBankAccountDto) {
    await this.findOneOrThrow(organizationId, id);
    return this.tx.bankAccount.update({
      where: { id },
      data: {
        name: dto.name,
        bankCode: dto.bankCode,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        isActive: dto.isActive,
      },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const bankAccount = await this.tx.bankAccount.findFirst({ where: { id, organizationId } });
    if (!bankAccount) {
      throw new NotFoundException("Conta bancária/caixa não encontrada.");
    }
    return bankAccount;
  }

  private async ensureGlAccountUsable(organizationId: string, glAccountId: string): Promise<void> {
    const account = await this.tx.account.findFirst({ where: { id: glAccountId, organizationId } });
    if (!account) {
      throw new BadRequestException("Conta contábil inválida para esta organização.");
    }
    if (!account.isAnalytic || !account.isActive) {
      throw new BadRequestException("Conta contábil precisa ser analítica e estar ativa.");
    }
  }
}
