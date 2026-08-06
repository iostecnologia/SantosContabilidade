import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { uuidv7 } from "uuidv7";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { BankAccountsService } from "../bank-accounts/bank-accounts.service";
import { CounterpartiesService } from "../counterparties/counterparties.service";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { CreateAccountsPayableDto } from "./dto/create-accounts-payable.dto";
import { RegisterPaymentDto } from "./dto/register-payment.dto";

/**
 * Criar um título posta imediatamente o lançamento de ACRÉSCIMO (débito
 * despesa/ativo, crédito passivo) — sem conceito de rascunho, igual ao resto
 * do sistema. Registrar pagamento posta o lançamento de LIQUIDAÇÃO (débito
 * passivo, crédito banco/caixa) e atualiza paid_amount/status. Correção é
 * sempre por cancelamento (que estorna o acréscimo) ou novo título — não há
 * edição genérica.
 */
@Injectable()
export class AccountsPayableService {
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
    return this.tx.accountsPayable.findMany({
      where: { organizationId },
      include: { payments: true },
      orderBy: { dueDate: "asc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const bill = await this.tx.accountsPayable.findFirst({
      where: { id, organizationId },
      include: { payments: true },
    });
    if (!bill) {
      throw new NotFoundException("Título a pagar não encontrado.");
    }
    return bill;
  }

  async create(organizationId: string, userId: string, dto: CreateAccountsPayableDto) {
    const counterparty = await this.counterparties.findOneOrThrow(organizationId, dto.counterpartyId);
    if (counterparty.type === "CUSTOMER") {
      throw new BadRequestException("Contraparte não é fornecedora (SUPPLIER ou BOTH).");
    }

    const billId = uuidv7();

    // Mesmo idioma do contador atômico de journal_entries, com counter_key
    // próprio — ver prisma/migrations/20260806000001_rls_and_triggers.
    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'accounts_payable', 1)
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
      description: `Contas a pagar nº ${documentNumber} — ${dto.description}`,
      referenceModule: "AP",
      referenceId: billId,
      lines: [
        {
          accountId: dto.expenseAccountId,
          costCenterId: dto.costCenterId,
          direction: "DEBIT",
          amount: dto.originalAmount,
        },
        { accountId: dto.liabilityAccountId, direction: "CREDIT", amount: dto.originalAmount },
      ],
    });

    await this.tx.accountsPayable.create({
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
        expenseAccountId: dto.expenseAccountId,
        liabilityAccountId: dto.liabilityAccountId,
        costCenterId: dto.costCenterId,
        accrualJournalEntryId: accrualEntry.id,
        createdBy: userId,
      },
    });

    return this.findOneOrThrow(organizationId, billId);
  }

  async registerPayment(organizationId: string, userId: string, id: string, dto: RegisterPaymentDto) {
    const bill = await this.findOneOrThrow(organizationId, id);
    const bankAccount = await this.bankAccounts.findOneOrThrow(organizationId, dto.bankAccountId);

    // Guarda de saldo + transição de status em UM único UPDATE atômico: sob
    // pagamentos concorrentes, o lock de linha do Postgres serializa as
    // tentativas e cada uma reavalia contra o valor já commitado da anterior
    // — evita overpayment por leitura-e-decisão em dois passos separados.
    const guardRows = await this.tx.$queryRaw<{ paid_amount: unknown; status: string }[]>`
      UPDATE accounts_payable
      SET paid_amount = paid_amount + ${dto.amount},
          status = CASE WHEN paid_amount + ${dto.amount} >= original_amount THEN 'PAID'::"TitleStatus" ELSE 'PARTIALLY_PAID'::"TitleStatus" END,
          updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId}
        AND status <> 'CANCELED'
        AND paid_amount + ${dto.amount} <= original_amount
      RETURNING paid_amount, status
    `;
    if (guardRows.length !== 1) {
      throw new ConflictException(
        "Não foi possível registrar o pagamento: título cancelado ou valor excede o saldo em aberto.",
      );
    }

    const settlementEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.paymentDate,
      competenceDate: dto.paymentDate,
      description: `Pagamento do título nº ${bill.documentNumber} — ${bill.description}`,
      referenceModule: "AP",
      referenceId: bill.id,
      lines: [
        { accountId: bill.liabilityAccountId, direction: "DEBIT", amount: dto.amount },
        { accountId: bankAccount.glAccountId, direction: "CREDIT", amount: dto.amount },
      ],
    });

    await this.tx.accountsPayablePayment.create({
      data: {
        organizationId,
        accountsPayableId: id,
        paymentDate: new Date(dto.paymentDate),
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
    if (Number(bill.paidAmount) > 0) {
      throw new ConflictException(
        "Título possui pagamentos registrados; não pode ser cancelado (histórico de liquidações é imutável).",
      );
    }

    await this.journalEntries.reverse(organizationId, userId, bill.accrualJournalEntryId);
    await this.tx.accountsPayable.update({ where: { id }, data: { status: "CANCELED" } });

    return this.findOneOrThrow(organizationId, id);
  }
}
