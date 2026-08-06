import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { TrialBalanceQueryDto } from "./dto/trial-balance-query.dto";
import { GeneralLedgerQueryDto } from "./dto/general-ledger-query.dto";
import { IncomeStatementQueryDto } from "./dto/income-statement-query.dto";
import { BalanceSheetQueryDto } from "./dto/balance-sheet-query.dto";

const CREDIT_NORMAL_TYPES = new Set(["LIABILITY", "EQUITY", "REVENUE"]);

interface AccountMovementRow {
  accountId: string;
  netDebit: number;
}

/**
 * Puramente de leitura — nenhum lançamento, nenhuma tabela nova. Tudo é
 * agregado em SQL bruto direto de journal_entry_lines/journal_entries
 * (mesmo padrão de BudgetService.variance), com cast para float8: são
 * relatórios de consulta, não postagem, então a precisão de Prisma.Decimal
 * não é necessária aqui. Escopo é achatado por conta analítica — sem
 * consolidação hierárquica por conta sintética (fica para uma iteração
 * futura se for pedido).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async trialBalance(organizationId: string, dto: TrialBalanceQueryDto) {
    const costCenterFilter = dto.costCenterId ? Prisma.sql`AND jel.cost_center_id = ${dto.costCenterId}` : Prisma.empty;

    const openingRows = await this.tx.$queryRaw<AccountMovementRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId}
        AND je.competence_date < ${dto.startDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;

    const periodRows = await this.tx.$queryRaw<
      { accountId: string; periodDebit: number; periodCredit: number }[]
    >`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE 0 END)::float8 AS "periodDebit",
        SUM(CASE WHEN jel.direction = 'CREDIT' THEN jel.amount ELSE 0 END)::float8 AS "periodCredit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId}
        AND je.competence_date BETWEEN ${dto.startDate}::date AND ${dto.endDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;

    const openingByAccount = new Map(openingRows.map((r) => [r.accountId, r.netDebit]));
    const accountIds = new Set([...openingByAccount.keys(), ...periodRows.map((r) => r.accountId)]);
    if (accountIds.size === 0) {
      return { startDate: dto.startDate, endDate: dto.endDate, rows: [] };
    }

    const accounts = await this.tx.account.findMany({ where: { id: { in: [...accountIds] }, organizationId } });
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const periodByAccount = new Map(periodRows.map((r) => [r.accountId, r]));

    const rows = [...accountIds]
      .map((accountId) => {
        const account = accountById.get(accountId);
        if (!account) {
          return null;
        }
        const openingNetDebit = openingByAccount.get(accountId) ?? 0;
        const period = periodByAccount.get(accountId) ?? { periodDebit: 0, periodCredit: 0 };
        const creditNormal = CREDIT_NORMAL_TYPES.has(account.type);
        const openingBalance = creditNormal ? -openingNetDebit : openingNetDebit;
        const closingNetDebit = openingNetDebit + period.periodDebit - period.periodCredit;
        const closingBalance = creditNormal ? -closingNetDebit : closingNetDebit;
        return {
          accountId,
          code: account.code,
          name: account.name,
          type: account.type,
          openingBalance,
          periodDebit: period.periodDebit,
          periodCredit: period.periodCredit,
          closingBalance,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.code.localeCompare(b.code));

    return { startDate: dto.startDate, endDate: dto.endDate, rows };
  }

  async generalLedger(organizationId: string, accountId: string, dto: GeneralLedgerQueryDto) {
    const account = await this.tx.account.findFirst({ where: { id: accountId, organizationId } });
    if (!account) {
      throw new NotFoundException("Conta contábil não encontrada.");
    }
    const creditNormal = CREDIT_NORMAL_TYPES.has(account.type);
    const costCenterFilter = dto.costCenterId ? Prisma.sql`AND jel.cost_center_id = ${dto.costCenterId}` : Prisma.empty;

    const openingRows = await this.tx.$queryRaw<AccountMovementRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId} AND jel.account_id = ${accountId}
        AND je.competence_date < ${dto.startDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;
    const openingNetDebit = openingRows[0]?.netDebit ?? 0;
    const openingBalance = creditNormal ? -openingNetDebit : openingNetDebit;

    const lines = await this.tx.$queryRaw<
      {
        journalEntryId: string;
        entryNumber: bigint;
        entryDate: Date;
        competenceDate: Date;
        description: string;
        direction: "DEBIT" | "CREDIT";
        amount: number;
      }[]
    >`
      SELECT je.id AS "journalEntryId", je.entry_number AS "entryNumber", je.entry_date AS "entryDate",
        je.competence_date AS "competenceDate", je.description, jel.direction, jel.amount::float8 AS amount
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId} AND jel.account_id = ${accountId}
        AND je.competence_date BETWEEN ${dto.startDate}::date AND ${dto.endDate}::date
        ${costCenterFilter}
      ORDER BY je.competence_date ASC, je.entry_number ASC
    `;

    let runningBalance = openingBalance;
    const rows = lines.map((line) => {
      const signedAmount = line.direction === "DEBIT" ? line.amount : -line.amount;
      runningBalance += creditNormal ? -signedAmount : signedAmount;
      return { ...line, runningBalance };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, type: account.type },
      startDate: dto.startDate,
      endDate: dto.endDate,
      openingBalance,
      closingBalance: runningBalance,
      rows,
    };
  }

  async incomeStatement(organizationId: string, dto: IncomeStatementQueryDto) {
    const costCenterFilter = dto.costCenterId ? Prisma.sql`AND jel.cost_center_id = ${dto.costCenterId}` : Prisma.empty;

    const rows = await this.tx.$queryRaw<AccountMovementRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE jel.organization_id = ${organizationId} AND a.type IN ('REVENUE', 'EXPENSE')
        AND je.competence_date BETWEEN ${dto.startDate}::date AND ${dto.endDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;

    const accounts = await this.accountsFor(organizationId, rows.map((r) => r.accountId));
    const lines = rows
      .map((r) => {
        const account = accounts.get(r.accountId);
        if (!account) {
          return null;
        }
        const amount = account.type === "REVENUE" ? -r.netDebit : r.netDebit;
        return { accountId: r.accountId, code: account.code, name: account.name, type: account.type, amount };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.code.localeCompare(b.code));

    const revenue = lines.filter((l) => l.type === "REVENUE");
    const expense = lines.filter((l) => l.type === "EXPENSE");
    const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0);
    const totalExpense = expense.reduce((s, l) => s + l.amount, 0);

    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      revenue,
      expense,
      totalRevenue,
      totalExpense,
      netResult: totalRevenue - totalExpense,
    };
  }

  async balanceSheet(organizationId: string, dto: BalanceSheetQueryDto) {
    const costCenterFilter = dto.costCenterId ? Prisma.sql`AND jel.cost_center_id = ${dto.costCenterId}` : Prisma.empty;

    const balanceRows = await this.tx.$queryRaw<AccountMovementRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE jel.organization_id = ${organizationId} AND a.type IN ('ASSET', 'LIABILITY', 'EQUITY')
        AND je.competence_date <= ${dto.asOfDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;

    // Resultado do período (receita - despesa acumulada até a data) não tem
    // lançamento de encerramento automático neste sistema (sem apuração de
    // resultado) — sem somar essa linha sintética ao PL, Ativo nunca bateria
    // com Passivo + PL sempre que houver receita/despesa lançada. É a mesma
    // identidade contábil fundamental, só calculada em vez de fechada por
    // lançamento.
    const resultRows = await this.tx.$queryRaw<AccountMovementRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE jel.organization_id = ${organizationId} AND a.type IN ('REVENUE', 'EXPENSE')
        AND je.competence_date <= ${dto.asOfDate}::date
        ${costCenterFilter}
      GROUP BY jel.account_id
    `;
    const accountTypes = await this.tx.account.findMany({
      where: { id: { in: resultRows.map((r) => r.accountId) }, organizationId },
      select: { id: true, type: true },
    });
    const typeById = new Map(accountTypes.map((a) => [a.id, a.type]));
    const netIncome = resultRows.reduce((sum, r) => {
      const type = typeById.get(r.accountId);
      return sum + (type === "REVENUE" ? -r.netDebit : r.netDebit);
    }, 0);

    const accounts = await this.accountsFor(organizationId, balanceRows.map((r) => r.accountId));
    const lines = balanceRows
      .map((r) => {
        const account = accounts.get(r.accountId);
        if (!account) {
          return null;
        }
        const amount = account.type === "ASSET" ? r.netDebit : -r.netDebit;
        return { accountId: r.accountId, code: account.code, name: account.name, type: account.type, amount };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.code.localeCompare(b.code));

    const assets = lines.filter((l) => l.type === "ASSET");
    const liabilities = lines.filter((l) => l.type === "LIABILITY");
    const equity = lines.filter((l) => l.type === "EQUITY");
    const totalAssets = assets.reduce((s, l) => s + l.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const totalEquity = equity.reduce((s, l) => s + l.amount, 0) + netIncome;

    return {
      asOfDate: dto.asOfDate,
      assets,
      liabilities,
      equity,
      netIncome,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }

  private async accountsFor(organizationId: string, accountIds: string[]) {
    if (accountIds.length === 0) {
      return new Map<string, { code: string; name: string; type: string }>();
    }
    const accounts = await this.tx.account.findMany({ where: { id: { in: accountIds }, organizationId } });
    return new Map(accounts.map((a) => [a.id, { code: a.code, name: a.name, type: a.type }]));
  }
}
