import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { uuidv7 } from "uuidv7";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { BankAccountsService } from "../bank-accounts/bank-accounts.service";
import { CounterpartiesService } from "../counterparties/counterparties.service";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { CreateAccountsReceivableDto } from "./dto/create-accounts-receivable.dto";
import { RegisterReceiptDto } from "./dto/register-receipt.dto";

/**
 * Espelho de AccountsPayableService: criar um título posta o lançamento de
 * ACRÉSCIMO (débito ativo "clientes a receber", crédito receita); registrar
 * recebimento posta a LIQUIDAÇÃO (débito banco/caixa, crédito ativo) e
 * atualiza received_amount/status. Mesma filosofia de imutabilidade —
 * correção é cancelamento (estorno do acréscimo) + novo título.
 */
@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly counterparties: CounterpartiesService,
    private readonly bankAccounts: BankAccountsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.accountsReceivable.findMany({
      where: { organizationId },
      include: { receipts: true },
      orderBy: { dueDate: "asc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const bill = await this.tx.accountsReceivable.findFirst({
      where: { id, organizationId },
      include: { receipts: true },
    });
    if (!bill) {
      throw new NotFoundException("Título a receber não encontrado.");
    }
    return bill;
  }

  async create(organizationId: string, userId: string, dto: CreateAccountsReceivableDto) {
    const counterparty = await this.counterparties.findOneOrThrow(organizationId, dto.counterpartyId);
    if (counterparty.type === "SUPPLIER") {
      throw new BadRequestException("Contraparte não é cliente (CUSTOMER ou BOTH).");
    }

    const billId = uuidv7();

    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'accounts_receivable', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número do título.");
    }
    const documentNumber = counterRows[0].current_value;

    const accrualEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.issueDate,
      competenceDate: dto.competenceDate,
      description: `Contas a receber nº ${documentNumber} — ${dto.description}`,
      referenceModule: "AR",
      referenceId: billId,
      lines: [
        {
          accountId: dto.assetAccountId,
          costCenterId: dto.costCenterId,
          direction: "DEBIT",
          amount: dto.originalAmount,
        },
        { accountId: dto.revenueAccountId, direction: "CREDIT", amount: dto.originalAmount },
      ],
    });

    await this.tx.accountsReceivable.create({
      data: {
        id: billId,
        organizationId,
        documentNumber,
        counterpartyId: dto.counterpartyId,
        description: dto.description,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        competenceDate: new Date(dto.competenceDate),
        originalAmount: dto.originalAmount,
        assetAccountId: dto.assetAccountId,
        revenueAccountId: dto.revenueAccountId,
        costCenterId: dto.costCenterId,
        accrualJournalEntryId: accrualEntry.id,
        createdBy: userId,
      },
    });

    return this.findOneOrThrow(organizationId, billId);
  }

  async registerReceipt(organizationId: string, userId: string, id: string, dto: RegisterReceiptDto) {
    const bill = await this.findOneOrThrow(organizationId, id);
    const bankAccount = await this.bankAccounts.findOneOrThrow(organizationId, dto.bankAccountId);

    // Mesmo padrão de UPDATE atômico com guarda de saldo de AccountsPayableService.registerPayment.
    const guardRows = await this.tx.$queryRaw<{ received_amount: unknown; status: string }[]>`
      UPDATE accounts_receivable
      SET received_amount = received_amount + ${dto.amount},
          status = CASE WHEN received_amount + ${dto.amount} >= original_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
          updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId}
        AND status <> 'CANCELED'
        AND received_amount + ${dto.amount} <= original_amount
      RETURNING received_amount, status
    `;
    if (guardRows.length !== 1) {
      throw new ConflictException(
        "Não foi possível registrar o recebimento: título cancelado ou valor excede o saldo em aberto.",
      );
    }

    const settlementEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.receiptDate,
      competenceDate: dto.receiptDate,
      description: `Recebimento do título nº ${bill.documentNumber} — ${bill.description}`,
      referenceModule: "AR",
      referenceId: bill.id,
      lines: [
        { accountId: bankAccount.glAccountId, direction: "DEBIT", amount: dto.amount },
        { accountId: bill.assetAccountId, direction: "CREDIT", amount: dto.amount },
      ],
    });

    await this.tx.accountsReceivableReceipt.create({
      data: {
        organizationId,
        accountsReceivableId: id,
        receiptDate: new Date(dto.receiptDate),
        amount: dto.amount,
        bankAccountId: dto.bankAccountId,
        journalEntryId: settlementEntry.id,
        createdBy: userId,
      },
    });

    return this.findOneOrThrow(organizationId, id);
  }

  async cancel(organizationId: string, userId: string, id: string) {
    const bill = await this.findOneOrThrow(organizationId, id);

    if (bill.status === "CANCELED") {
      throw new ConflictException("Título já está cancelado.");
    }
    if (Number(bill.receivedAmount) > 0) {
      throw new ConflictException(
        "Título possui recebimentos registrados; não pode ser cancelado (histórico de liquidações é imutável).",
      );
    }

    await this.journalEntries.reverse(organizationId, userId, bill.accrualJournalEntryId);
    await this.tx.accountsReceivable.update({ where: { id }, data: { status: "CANCELED" } });

    return this.findOneOrThrow(organizationId, id);
  }
}
