import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { uuidv7 } from "uuidv7";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";
import { CreateJournalEntryLineDto } from "./dto/create-journal-entry-line.dto";

/**
 * O balanceamento (débito = crédito) e a postabilidade de cada conta são
 * garantidos de verdade por triggers no Postgres (ver migração de
 * RLS/triggers) — a validação aqui é só para devolver um erro amigável
 * antes do round-trip. Journal entries não têm rota de UPDATE/DELETE: o
 * papel de runtime (app_user) tem esses privilégios revogados na tabela no
 * banco. Correção é sempre por estorno (nova entrada, nunca edição).
 */
@Injectable()
export class JournalEntriesService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.journalEntry.findMany({
      where: { organizationId },
      include: { lines: true },
      orderBy: { entryNumber: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const entry = await this.tx.journalEntry.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException("Lançamento contábil não encontrado.");
    }
    return entry;
  }

  async create(organizationId: string, userId: string, dto: CreateJournalEntryDto, reversalOfId?: string) {
    this.validateBalance(dto.lines);

    const entryId = uuidv7();

    // Incremento atômico do contador por organização, na MESMA transação do
    // lançamento: se o lançamento falhar/rollback, o número volta junto —
    // numeração realmente sem buracos, sem contenção entre tenants
    // diferentes (cada org trava só a própria linha do contador).
    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'journal_entry', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número do lançamento.");
    }
    const entryNumber = counterRows[0].current_value;

    await this.tx.journalEntry.create({
      data: {
        id: entryId,
        organizationId,
        entryNumber,
        entryDate: new Date(dto.entryDate),
        competenceDate: new Date(dto.competenceDate),
        description: dto.description,
        referenceModule: dto.referenceModule ?? "MANUAL",
        referenceId: dto.referenceId,
        reversalOfId,
        createdBy: userId,
      },
    });

    // Cada linha é validada individualmente por trigger BEFORE INSERT; o
    // balanceamento total é checado no COMMIT (constraint trigger deferred),
    // então a ordem de inserção das linhas não importa.
    let lineNumber = 1;
    for (const line of dto.lines) {
      await this.tx.journalEntryLine.create({
        data: {
          organizationId,
          journalEntryId: entryId,
          accountId: line.accountId,
          costCenterId: line.costCenterId,
          direction: line.direction,
          amount: line.amount,
          lineNumber: lineNumber++,
        },
      });
    }

    return this.findOneOrThrow(organizationId, entryId);
  }

  async reverse(organizationId: string, userId: string, id: string) {
    const original = await this.findOneOrThrow(organizationId, id);

    if (original.reversalOfId) {
      throw new BadRequestException("Não é possível estornar um lançamento que já é, ele próprio, um estorno.");
    }
    const existingReversal = await this.tx.journalEntry.findFirst({
      where: { organizationId, reversalOfId: original.id },
    });
    if (existingReversal) {
      throw new ConflictException("Este lançamento já foi estornado.");
    }

    const reversalLines: CreateJournalEntryLineDto[] = original.lines.map((line) => ({
      accountId: line.accountId,
      costCenterId: line.costCenterId ?? undefined,
      direction: line.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: Number(line.amount),
    }));

    const today = new Date().toISOString().slice(0, 10);

    return this.create(
      organizationId,
      userId,
      {
        entryDate: today,
        competenceDate: today,
        description: `Estorno do lançamento nº ${original.entryNumber} — ${original.description}`,
        referenceModule: original.referenceModule,
        referenceId: original.id,
        lines: reversalLines,
      },
      original.id,
    );
  }

  private validateBalance(lines: CreateJournalEntryLineDto[]): void {
    let debitTotal = 0;
    let creditTotal = 0;
    let hasDebit = false;
    let hasCredit = false;

    for (const line of lines) {
      if (line.direction === "DEBIT") {
        debitTotal += line.amount;
        hasDebit = true;
      } else {
        creditTotal += line.amount;
        hasCredit = true;
      }
    }

    if (!hasDebit || !hasCredit) {
      throw new BadRequestException("O lançamento precisa de ao menos uma linha de débito e uma de crédito.");
    }
    if (Math.abs(debitTotal - creditTotal) > 0.005) {
      throw new BadRequestException(
        `Lançamento desbalanceado: débitos ${debitTotal.toFixed(2)} ≠ créditos ${creditTotal.toFixed(2)}.`,
      );
    }
  }
}
