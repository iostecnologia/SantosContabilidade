import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateBudgetPlanDto } from "./dto/create-budget-plan.dto";
import { UpdateBudgetPlanDto } from "./dto/update-budget-plan.dto";
import { CreateBudgetLineDto } from "./dto/create-budget-line.dto";
import { UpdateBudgetLineDto } from "./dto/update-budget-line.dto";

interface RealizedRow {
  accountId: string;
  costCenterId: string;
  month: number;
  netDebit: number;
}

/**
 * Orçamento é razão auxiliar de planejamento: cadastrar um plano ou suas
 * linhas não posta lançamento algum (mesmo raciocínio de FixedAsset — ver
 * comentário no schema). Um plano começa em DRAFT, onde nome/ano/linhas são
 * livremente editáveis; ao ser aprovado (APPROVED) fica imutável — correção
 * é sempre por um novo plano, nunca edição — e pode depois ser encerrado
 * (CLOSED), estado terminal. Essa imutabilidade é garantida aqui na camada
 * de aplicação (não há REVOKE de banco, ver migração de RLS do módulo),
 * porque, diferente de lançamentos, a edição em DRAFT é legítima.
 */
@Injectable()
export class BudgetService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.budgetPlan.findMany({
      where: { organizationId },
      include: { lines: true },
      orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const plan = await this.tx.budgetPlan.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!plan) {
      throw new NotFoundException("Plano orçamentário não encontrado.");
    }
    return plan;
  }

  create(organizationId: string, userId: string, dto: CreateBudgetPlanDto) {
    return this.tx.budgetPlan.create({
      data: {
        organizationId,
        fiscalYear: dto.fiscalYear,
        name: dto.name,
        createdBy: userId,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateBudgetPlanDto) {
    const plan = await this.findOneOrThrow(organizationId, id);
    this.ensureDraft(plan);

    return this.tx.budgetPlan.update({
      where: { id },
      data: { fiscalYear: dto.fiscalYear, name: dto.name },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const plan = await this.findOneOrThrow(organizationId, id);
    this.ensureDraft(plan);

    await this.tx.budgetPlan.delete({ where: { id } });
  }

  async approve(organizationId: string, userId: string, id: string) {
    const plan = await this.findOneOrThrow(organizationId, id);
    this.ensureDraft(plan);
    if (plan.lines.length === 0) {
      throw new BadRequestException("Plano orçamentário não tem linhas; adicione ao menos uma antes de aprovar.");
    }

    await this.tx.budgetPlan.update({
      where: { id },
      data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async close(organizationId: string, id: string) {
    const plan = await this.findOneOrThrow(organizationId, id);
    if (plan.status !== "APPROVED") {
      throw new ConflictException("Só um plano orçamentário aprovado pode ser encerrado.");
    }

    await this.tx.budgetPlan.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
    return this.findOneOrThrow(organizationId, id);
  }

  async addLine(organizationId: string, planId: string, dto: CreateBudgetLineDto) {
    const plan = await this.findOneOrThrow(organizationId, planId);
    this.ensureDraft(plan);
    await this.ensureAccountUsable(organizationId, dto.accountId);
    await this.ensureCostCenterUsable(organizationId, dto.costCenterId);

    try {
      await this.tx.budgetLine.create({
        data: {
          organizationId,
          budgetPlanId: planId,
          accountId: dto.accountId,
          costCenterId: dto.costCenterId,
          month: dto.month,
          amount: dto.amount,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe linha orçada para esta conta/centro de custo/mês neste plano.");
      }
      throw err;
    }

    return this.findOneOrThrow(organizationId, planId);
  }

  async updateLine(organizationId: string, planId: string, lineId: string, dto: UpdateBudgetLineDto) {
    const plan = await this.findOneOrThrow(organizationId, planId);
    this.ensureDraft(plan);
    const line = plan.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Linha orçamentária não encontrada.");
    }

    await this.tx.budgetLine.update({ where: { id: lineId }, data: { amount: dto.amount } });
    return this.findOneOrThrow(organizationId, planId);
  }

  async removeLine(organizationId: string, planId: string, lineId: string): Promise<void> {
    const plan = await this.findOneOrThrow(organizationId, planId);
    this.ensureDraft(plan);
    const line = plan.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Linha orçamentária não encontrada.");
    }

    await this.tx.budgetLine.delete({ where: { id: lineId } });
  }

  /**
   * Realizado x orçado por conta/centro de custo/mês. O realizado é somado
   * direto de journal_entry_lines (nunca gravado aqui) e ajustado ao sinal
   * natural da conta (débito para ATIVO/DESPESA, crédito para
   * PASSIVO/PL/RECEITA) para ficar comparável ao valor orçado. A soma é
   * calculada em SQL bruto com cast para double precision — aceitável para
   * um relatório de leitura (não gera lançamento nem decide postagem),
   * diferente da aritmética de depreciação que usa Prisma.Decimal.
   */
  async variance(organizationId: string, planId: string) {
    const plan = await this.findOneOrThrow(organizationId, planId);

    const accountIds = [...new Set(plan.lines.map((l) => l.accountId))];
    const accounts = accountIds.length
      ? await this.tx.account.findMany({ where: { id: { in: accountIds }, organizationId } })
      : [];
    const accountTypeById = new Map(accounts.map((a) => [a.id, a.type]));

    const realizedRows = await this.tx.$queryRaw<RealizedRow[]>`
      SELECT jel.account_id AS "accountId", jel.cost_center_id AS "costCenterId",
             EXTRACT(MONTH FROM je.competence_date)::int AS month,
             SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId}
        AND jel.cost_center_id IS NOT NULL
        AND EXTRACT(YEAR FROM je.competence_date) = ${plan.fiscalYear}
      GROUP BY jel.account_id, jel.cost_center_id, EXTRACT(MONTH FROM je.competence_date)
    `;

    const key = (accountId: string, costCenterId: string, month: number) => `${accountId}|${costCenterId}|${month}`;
    const realizedByKey = new Map(realizedRows.map((r) => [key(r.accountId, r.costCenterId, r.month), r.netDebit]));

    const rows = plan.lines.map((line) => {
      const netDebit = realizedByKey.get(key(line.accountId, line.costCenterId, line.month)) ?? 0;
      const accountType = accountTypeById.get(line.accountId);
      const creditNormal = accountType === "LIABILITY" || accountType === "EQUITY" || accountType === "REVENUE";
      const realized = creditNormal ? -netDebit : netDebit;
      const budgeted = line.amount.toNumber();
      return {
        accountId: line.accountId,
        costCenterId: line.costCenterId,
        month: line.month,
        budgeted,
        realized,
        variance: budgeted - realized,
      };
    });

    return { plan: { id: plan.id, fiscalYear: plan.fiscalYear, name: plan.name, status: plan.status }, rows };
  }

  private ensureDraft(plan: { status: string }): void {
    if (plan.status !== "DRAFT") {
      throw new ConflictException("Plano orçamentário não está em rascunho; não pode ser alterado.");
    }
  }

  private async ensureAccountUsable(organizationId: string, accountId: string): Promise<void> {
    const account = await this.tx.account.findFirst({ where: { id: accountId, organizationId } });
    if (!account) {
      throw new BadRequestException("Conta contábil inválida para esta organização.");
    }
    if (!account.isAnalytic || !account.isActive) {
      throw new BadRequestException("Conta contábil precisa ser analítica e estar ativa.");
    }
  }

  private async ensureCostCenterUsable(organizationId: string, costCenterId: string): Promise<void> {
    const costCenter = await this.tx.costCenter.findFirst({ where: { id: costCenterId, organizationId } });
    if (!costCenter) {
      throw new BadRequestException("Centro de custo inválido para esta organização.");
    }
    if (!costCenter.isActive) {
      throw new BadRequestException("Centro de custo precisa estar ativo.");
    }
  }
}
