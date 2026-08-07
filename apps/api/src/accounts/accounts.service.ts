import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

/**
 * Regras de hierarquia (só folha é analítica, só analítica recebe
 * lançamento) são garantidas de verdade por triggers no banco — ver
 * prisma/migrations/20260806000001_rls_and_triggers/migration.sql. As
 * checagens aqui existem só para devolver um erro amigável antes do
 * round-trip; a fonte de verdade é o Postgres.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
  }

  async create(organizationId: string, dto: CreateAccountDto) {
    if (dto.parentId) {
      await this.findOneOrThrow(organizationId, dto.parentId);
    }
    if (dto.costCenterId) {
      await this.ensureCostCenterExists(organizationId, dto.costCenterId);
    }

    try {
      return await this.tx.account.create({
        data: {
          organizationId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId,
          costCenterId: dto.costCenterId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe uma conta com este código nesta organização.");
      }
      throw err;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateAccountDto) {
    await this.findOneOrThrow(organizationId, id);
    if (dto.costCenterId) {
      await this.ensureCostCenterExists(organizationId, dto.costCenterId);
    }
    return this.tx.account.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        costCenterId: dto.costCenterId,
        spedReferenceCode: dto.spedReferenceCode,
      },
    });
  }

  private async ensureCostCenterExists(organizationId: string, costCenterId: string): Promise<void> {
    const costCenter = await this.tx.costCenter.findFirst({ where: { id: costCenterId, organizationId } });
    if (!costCenter) {
      throw new BadRequestException("Centro de custo inválido para esta organização.");
    }
  }

  private async findOneOrThrow(organizationId: string, id: string) {
    const account = await this.tx.account.findFirst({ where: { id, organizationId } });
    if (!account) {
      throw new NotFoundException("Conta contábil não encontrada.");
    }
    return account;
  }
}
