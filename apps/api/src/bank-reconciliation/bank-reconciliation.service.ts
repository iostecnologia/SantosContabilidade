import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { BankStatementLine, JournalEntryLine, LineDirection } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { BankAccountsService } from "../bank-accounts/bank-accounts.service";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { parseOfx } from "./ofx-parser";
import { ManualMatchDto } from "./dto/manual-match.dto";
import { CreateAdjustmentEntryDto } from "./dto/create-adjustment-entry.dto";

const AUTO_MATCH_WINDOW_DAYS = 10;
// Décimo de centavo — mesma tolerância usada em JournalEntriesService.validateBalance.
const BALANCE_TOLERANCE = 0.01;

/**
 * Uma sessão de conciliação nasce de um upload de OFX: cada transação do
 * banco vira uma BankStatementLine, casada automaticamente (mesmo valor +
 * sentido, na conta contábil do BankAccount, dentro de uma janela de dias)
 * contra lançamentos já existentes. O que não casa fica PENDING para o
 * usuário resolver manualmente — via match com um lançamento existente, via
 * lançamento de ajuste criado na hora (ADJUSTED), ou marcando como IGNORED.
 * Fechar exige zero linhas PENDING e o saldo do razão batendo com o saldo
 * informado pelo banco (LEDGERBAL) na data final do período — mesmo
 * raciocínio de fechamento de BudgetPlan (regra de aplicação, não de banco).
 */
@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly bankAccounts: BankAccountsService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string, bankAccountId?: string) {
    return this.tx.bankReconciliation.findMany({
      where: { organizationId, ...(bankAccountId ? { bankAccountId } : {}) },
      include: { bankAccount: true },
      orderBy: { periodStart: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const reconciliation = await this.tx.bankReconciliation.findFirst({
      where: { id, organizationId },
      include: {
        bankAccount: true,
        lines: {
          include: { matchedJournalEntryLine: { include: { journalEntry: true } } },
          orderBy: { transactionDate: "asc" },
        },
      },
    });
    if (!reconciliation) {
      throw new NotFoundException("Conciliação bancária não encontrada.");
    }
    return reconciliation;
  }

  async getSummary(organizationId: string, id: string) {
    const reconciliation = await this.findOneOrThrow(organizationId, id);
    const systemBalance = await this.getGlBalanceAsOf(
      organizationId,
      reconciliation.bankAccount.glAccountId,
      reconciliation.periodEnd,
    );
    const statementClosingBalance = Number(reconciliation.statementClosingBalance);
    const pendingCount = reconciliation.lines.filter((l) => l.status === "PENDING").length;
    const difference = statementClosingBalance - systemBalance;

    return {
      statementClosingBalance,
      systemBalance,
      difference,
      pendingCount,
      canClose: reconciliation.status === "OPEN" && pendingCount === 0 && Math.abs(difference) <= BALANCE_TOLERANCE,
    };
  }

  async importStatement(organizationId: string, userId: string, bankAccountId: string, fileContent: string) {
    if (!bankAccountId) {
      throw new BadRequestException("Conta bancária/caixa é obrigatória.");
    }
    const bankAccount = await this.bankAccounts.findOneOrThrow(organizationId, bankAccountId);

    let parsed;
    try {
      parsed = parseOfx(fileContent);
    } catch {
      throw new BadRequestException("Arquivo OFX inválido ou corrompido.");
    }
    if (parsed.transactions.length === 0) {
      throw new BadRequestException("Nenhuma transação encontrada no arquivo OFX.");
    }
    if (!parsed.ledgerBalance) {
      throw new BadRequestException("Arquivo OFX não informa o saldo final (LEDGERBAL).");
    }

    const postedDates = parsed.transactions.map((t) => t.postedAt).filter((d): d is string => Boolean(d)).sort();
    const periodStart = parsed.periodStart ?? postedDates[0];
    const periodEnd = parsed.periodEnd ?? postedDates[postedDates.length - 1];
    if (!periodStart || !periodEnd) {
      throw new BadRequestException("Não foi possível determinar o período do extrato.");
    }

    // Impede reimportar um extrato cobrindo (parte de) um período já trazido
    // antes para a mesma conta — evita contar o mesmo saldo/transações duas vezes.
    const overlapping = await this.tx.bankReconciliation.findFirst({
      where: {
        organizationId,
        bankAccountId,
        periodStart: { lte: new Date(periodEnd) },
        periodEnd: { gte: new Date(periodStart) },
      },
    });
    if (overlapping) {
      throw new ConflictException("Já existe uma conciliação para esta conta cobrindo (parte d)este período.");
    }

    const reconciliation = await this.tx.bankReconciliation.create({
      data: {
        organizationId,
        bankAccountId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        statementClosingBalance: parsed.ledgerBalance.amount,
        createdBy: userId,
      },
    });

    // Dentro de um único import, evita que duas transações do próprio OFX
    // "briguem" pelo mesmo lançamento candidato — cada um só pode ser usado uma vez.
    const assignedInThisImport = new Set<string>();

    for (const txn of parsed.transactions) {
      if (!txn.postedAt) {
        continue;
      }
      const matchedLine = await this.findAutoMatchCandidate(
        organizationId,
        bankAccount.glAccountId,
        txn.amount,
        txn.postedAt,
        assignedInThisImport,
      );
      if (matchedLine) {
        assignedInThisImport.add(matchedLine.id);
      }

      await this.tx.bankStatementLine.create({
        data: {
          organizationId,
          bankReconciliationId: reconciliation.id,
          bankAccountId,
          transactionDate: new Date(txn.postedAt),
          amount: txn.amount,
          description: txn.description,
          fitId: txn.fitId,
          status: matchedLine ? "MATCHED" : "PENDING",
          matchedJournalEntryLineId: matchedLine?.id,
        },
      });
    }

    return this.findOneOrThrow(organizationId, reconciliation.id);
  }

  async manualMatch(organizationId: string, id: string, lineId: string, dto: ManualMatchDto) {
    const reconciliation = await this.assertOpen(organizationId, id);
    const line = this.getLineOrThrow(reconciliation, lineId);
    if (line.status !== "PENDING") {
      throw new ConflictException("Esta linha do extrato já foi tratada.");
    }

    const journalLine = await this.tx.journalEntryLine.findFirst({
      where: { id: dto.journalEntryLineId, organizationId, accountId: reconciliation.bankAccount.glAccountId },
    });
    if (!journalLine) {
      throw new BadRequestException("Lançamento inválido para a conta contábil desta conta bancária.");
    }

    const expectedDirection: LineDirection = Number(line.amount) >= 0 ? "DEBIT" : "CREDIT";
    if (journalLine.direction !== expectedDirection || Number(journalLine.amount) !== Math.abs(Number(line.amount))) {
      throw new BadRequestException("O lançamento selecionado não bate com o valor/sentido desta linha do extrato.");
    }

    const alreadyMatched = await this.tx.bankStatementLine.findFirst({
      where: { organizationId, matchedJournalEntryLineId: dto.journalEntryLineId },
    });
    if (alreadyMatched) {
      throw new ConflictException("Este lançamento já está conciliado com outra linha do extrato.");
    }

    await this.tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "MATCHED", matchedJournalEntryLineId: dto.journalEntryLineId },
    });

    return this.findOneOrThrow(organizationId, id);
  }

  async resetLine(organizationId: string, id: string, lineId: string) {
    const reconciliation = await this.assertOpen(organizationId, id);
    const line = this.getLineOrThrow(reconciliation, lineId);
    if (line.status !== "MATCHED" && line.status !== "IGNORED") {
      throw new ConflictException(
        "Só é possível desfazer uma linha conciliada (manual ou automaticamente) ou ignorada. " +
          "Um ajuste (ADJUSTED) já postou um lançamento imutável — correção é pelo módulo de Lançamentos, não por aqui.",
      );
    }
    await this.tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "PENDING", matchedJournalEntryLineId: null },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async ignore(organizationId: string, id: string, lineId: string) {
    const reconciliation = await this.assertOpen(organizationId, id);
    const line = this.getLineOrThrow(reconciliation, lineId);
    if (line.status !== "PENDING") {
      throw new ConflictException("Só é possível ignorar uma linha ainda pendente.");
    }
    await this.tx.bankStatementLine.update({ where: { id: lineId }, data: { status: "IGNORED" } });
    return this.findOneOrThrow(organizationId, id);
  }

  async createAdjustmentEntry(
    organizationId: string,
    userId: string,
    id: string,
    lineId: string,
    dto: CreateAdjustmentEntryDto,
  ) {
    const reconciliation = await this.assertOpen(organizationId, id);
    const line = this.getLineOrThrow(reconciliation, lineId);
    if (line.status !== "PENDING") {
      throw new ConflictException("Esta linha do extrato já foi tratada.");
    }
    if (dto.contraAccountId === reconciliation.bankAccount.glAccountId) {
      throw new BadRequestException("A contrapartida não pode ser a própria conta do banco.");
    }

    const amount = Math.abs(Number(line.amount));
    const bankDirection: LineDirection = Number(line.amount) >= 0 ? "DEBIT" : "CREDIT";
    const contraDirection: LineDirection = bankDirection === "DEBIT" ? "CREDIT" : "DEBIT";
    const dateStr = line.transactionDate.toISOString().slice(0, 10);

    const entry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dateStr,
      competenceDate: dateStr,
      description: dto.description || `Ajuste de conciliação bancária — ${line.description}`,
      referenceModule: "BANK_RECONCILIATION",
      referenceId: reconciliation.id,
      lines: [
        { accountId: reconciliation.bankAccount.glAccountId, direction: bankDirection, amount },
        { accountId: dto.contraAccountId, costCenterId: dto.costCenterId, direction: contraDirection, amount },
      ],
    });

    const bankLine = entry.lines.find((l) => l.accountId === reconciliation.bankAccount.glAccountId);
    if (!bankLine) {
      throw new ConflictException("Falha ao localizar a linha do lançamento gerado para a conta do banco.");
    }

    await this.tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "ADJUSTED", matchedJournalEntryLineId: bankLine.id },
    });

    return this.findOneOrThrow(organizationId, id);
  }

  async close(organizationId: string, id: string) {
    const reconciliation = await this.assertOpen(organizationId, id);
    const pending = reconciliation.lines.filter((l) => l.status === "PENDING");
    if (pending.length > 0) {
      throw new ConflictException(`Ainda há ${pending.length} linha(s) pendente(s) nesta conciliação.`);
    }

    const systemBalance = await this.getGlBalanceAsOf(
      organizationId,
      reconciliation.bankAccount.glAccountId,
      reconciliation.periodEnd,
    );
    const statementClosingBalance = Number(reconciliation.statementClosingBalance);
    const difference = statementClosingBalance - systemBalance;
    if (Math.abs(difference) > BALANCE_TOLERANCE) {
      throw new ConflictException(
        `Saldo não bate: extrato R$ ${statementClosingBalance.toFixed(2)} vs. sistema R$ ${systemBalance.toFixed(2)} ` +
          `(diferença R$ ${difference.toFixed(2)}).`,
      );
    }

    await this.tx.bankReconciliation.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    await this.assertOpen(organizationId, id);
    await this.tx.bankStatementLine.deleteMany({ where: { bankReconciliationId: id, organizationId } });
    await this.tx.bankReconciliation.delete({ where: { id } });
  }

  async findMatchCandidates(organizationId: string, id: string, lineId: string) {
    const reconciliation = await this.findOneOrThrow(organizationId, id);
    const line = this.getLineOrThrow(reconciliation, lineId);
    const direction: LineDirection = Number(line.amount) >= 0 ? "DEBIT" : "CREDIT";

    const candidates = await this.tx.journalEntryLine.findMany({
      where: {
        organizationId,
        accountId: reconciliation.bankAccount.glAccountId,
        direction,
        reconciliationMatch: null,
      },
      include: { journalEntry: true },
      take: 100,
    });

    return candidates.sort((a, b) => b.journalEntry.entryDate.getTime() - a.journalEntry.entryDate.getTime());
  }

  private async findAutoMatchCandidate(
    organizationId: string,
    glAccountId: string,
    amount: number,
    postedAt: string,
    alreadyAssigned: Set<string>,
  ): Promise<JournalEntryLine | null> {
    const direction: LineDirection = amount >= 0 ? "DEBIT" : "CREDIT";
    const absAmount = Math.abs(amount);
    const posted = new Date(postedAt);
    const windowStart = new Date(posted);
    windowStart.setDate(windowStart.getDate() - AUTO_MATCH_WINDOW_DAYS);
    const windowEnd = new Date(posted);
    windowEnd.setDate(windowEnd.getDate() + AUTO_MATCH_WINDOW_DAYS);

    const candidates = await this.tx.journalEntryLine.findMany({
      where: {
        organizationId,
        accountId: glAccountId,
        direction,
        amount: absAmount,
        reconciliationMatch: null,
        journalEntry: { entryDate: { gte: windowStart, lte: windowEnd } },
      },
      include: { journalEntry: true },
    });

    const available = candidates.filter((c) => !alreadyAssigned.has(c.id));
    if (available.length === 0) {
      return null;
    }
    available.sort(
      (a, b) =>
        Math.abs(a.journalEntry.entryDate.getTime() - posted.getTime()) -
        Math.abs(b.journalEntry.entryDate.getTime() - posted.getTime()),
    );
    return available[0];
  }

  private async getGlBalanceAsOf(organizationId: string, accountId: string, asOf: Date): Promise<number> {
    const rows = await this.tx.$queryRaw<{ balance: number }[]>`
      SELECT COALESCE(SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END), 0)::float8 AS balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId}
        AND jel.account_id = ${accountId}
        AND je.entry_date <= ${asOf}
    `;
    return rows[0]?.balance ?? 0;
  }

  private async assertOpen(organizationId: string, id: string) {
    const reconciliation = await this.findOneOrThrow(organizationId, id);
    if (reconciliation.status !== "OPEN") {
      throw new ConflictException("Esta conciliação já está fechada.");
    }
    return reconciliation;
  }

  private getLineOrThrow(
    reconciliation: Awaited<ReturnType<BankReconciliationService["findOneOrThrow"]>>,
    lineId: string,
  ): BankStatementLine {
    const line = reconciliation.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Linha do extrato não encontrada.");
    }
    return line;
  }
}
