import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { LineDirection, PayrollSettings } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { PayrollSettingsService } from "./payroll-settings.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { calculateProgressiveTax, toTaxBracketInputs } from "./payroll-calculation.util";

/**
 * Folha mensal: uma rodada por competência (ano+mês), com uma linha
 * calculada por funcionário ativo naquele mês. Ao postar, gera UM lançamento
 * contábil agregado (soma de todos os funcionários) — é assim que a
 * contabilidade de folha normalmente funciona na prática (não um lançamento
 * por funcionário). Ver comentário em `buildJournalLines` para o desenho
 * completo de débito/crédito, incluindo a simplificação assumida para o
 * desconto de vale-transporte (ver custo já registrado em outro lugar, ex.
 * Contas a Pagar, no momento da compra do vale — aqui só desviamos o valor
 * retido do líquido para a mesma conta de benefícios a pagar).
 */
@Injectable()
export class PayrollRunService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly payrollSettings: PayrollSettingsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.payrollRun.findMany({
      where: { organizationId },
      orderBy: [{ competenceYear: "desc" }, { competenceMonth: "desc" }],
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const run = await this.tx.payrollRun.findFirst({
      where: { id, organizationId },
      include: { lines: { include: { employee: true } } },
    });
    if (!run) {
      throw new NotFoundException("Folha de pagamento não encontrada.");
    }
    return run;
  }

  async create(organizationId: string, userId: string, dto: CreatePayrollRunDto) {
    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'payroll_run', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número da folha.");
    }

    try {
      const run = await this.tx.payrollRun.create({
        data: {
          organizationId,
          runNumber: counterRows[0].current_value,
          competenceYear: dto.competenceYear,
          competenceMonth: dto.competenceMonth,
          createdBy: userId,
        },
      });
      return this.findOneOrThrow(organizationId, run.id);
    } catch {
      throw new ConflictException("Já existe uma folha para esta competência.");
    }
  }

  async calculate(organizationId: string, id: string) {
    const run = await this.assertNotPosted(organizationId, id);
    const settings = await this.payrollSettings.getOrCreate(organizationId);

    const monthStart = new Date(Date.UTC(run.competenceYear, run.competenceMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(run.competenceYear, run.competenceMonth, 0));

    const employees = await this.tx.employee.findMany({
      where: {
        organizationId,
        admissionDate: { lte: monthEnd },
        OR: [{ terminationDate: null }, { terminationDate: { gte: monthStart } }],
      },
    });

    const inssBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "INSS"));
    const irrfBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "IRRF"));

    await this.tx.payrollRunLine.deleteMany({ where: { payrollRunId: id } });

    for (const employee of employees) {
      const baseSalary = Number(employee.baseSalary);
      const inssAmount = Math.min(
        calculateProgressiveTax(baseSalary, inssBrackets),
        Number(settings.inssCeiling),
      );
      const irrfBase = baseSalary - inssAmount - employee.dependentsCount * Number(settings.irrfDependentDeduction);
      const irrfAmount = calculateProgressiveTax(irrfBase, irrfBrackets);
      const fgtsAmount = baseSalary * Number(settings.fgtsRate);
      const employerInssAmount = baseSalary * Number(settings.employerInssRate);

      const transportVoucherValue = Number(employee.transportVoucherMonthlyValue ?? 0);
      const transportVoucherDiscount = Math.min(
        transportVoucherValue,
        baseSalary * Number(settings.transportVoucherMaxDiscountRate),
      );
      const mealVoucherBenefit = Number(employee.mealVoucherMonthlyValue ?? 0);
      const mealVoucherDiscount = mealVoucherBenefit * Number(employee.mealVoucherDiscountRate ?? 0);

      const netPay = baseSalary - inssAmount - irrfAmount - transportVoucherDiscount - mealVoucherDiscount;

      await this.tx.payrollRunLine.create({
        data: {
          organizationId,
          payrollRunId: id,
          employeeId: employee.id,
          baseSalary,
          inssAmount,
          irrfAmount,
          fgtsAmount,
          employerInssAmount,
          transportVoucherDiscount,
          mealVoucherBenefit,
          mealVoucherDiscount,
          netPay,
        },
      });
    }

    await this.tx.payrollRun.update({ where: { id }, data: { status: "CALCULATED" } });
    return this.findOneOrThrow(organizationId, id);
  }

  async post(organizationId: string, userId: string, id: string) {
    const run = await this.findOneOrThrow(organizationId, id);
    if (run.status !== "CALCULATED") {
      throw new ConflictException("A folha precisa estar calculada antes de ser postada.");
    }
    if (run.lines.length === 0) {
      throw new BadRequestException("Folha sem nenhuma linha calculada.");
    }
    const settings = await this.payrollSettings.getOrCreate(organizationId);

    const totals = run.lines.reduce(
      (acc, line) => ({
        baseSalary: acc.baseSalary + Number(line.baseSalary),
        netPay: acc.netPay + Number(line.netPay),
        inss: acc.inss + Number(line.inssAmount),
        irrf: acc.irrf + Number(line.irrfAmount),
        fgts: acc.fgts + Number(line.fgtsAmount),
        employerInss: acc.employerInss + Number(line.employerInssAmount),
        mealVoucherBenefit: acc.mealVoucherBenefit + Number(line.mealVoucherBenefit),
        mealVoucherDiscount: acc.mealVoucherDiscount + Number(line.mealVoucherDiscount),
        transportVoucherDiscount: acc.transportVoucherDiscount + Number(line.transportVoucherDiscount),
      }),
      {
        baseSalary: 0,
        netPay: 0,
        inss: 0,
        irrf: 0,
        fgts: 0,
        employerInss: 0,
        mealVoucherBenefit: 0,
        mealVoucherDiscount: 0,
        transportVoucherDiscount: 0,
      },
    );

    const lines = buildPayrollJournalLines(settings, totals);

    const entry = await this.journalEntries.create(organizationId, userId, {
      entryDate: new Date(Date.UTC(run.competenceYear, run.competenceMonth, 0)).toISOString().slice(0, 10),
      competenceDate: new Date(Date.UTC(run.competenceYear, run.competenceMonth - 1, 1)).toISOString().slice(0, 10),
      description: `Folha de pagamento ${String(run.competenceMonth).padStart(2, "0")}/${run.competenceYear} — nº ${run.runNumber}`,
      referenceModule: "PAYROLL",
      referenceId: run.id,
      lines,
    });

    await this.tx.payrollRun.update({
      where: { id },
      data: { status: "POSTED", journalEntryId: entry.id, postedAt: new Date() },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.assertNotPosted(organizationId, id);
    await this.tx.payrollRunLine.deleteMany({ where: { payrollRunId: id } });
    await this.tx.payrollRun.delete({ where: { id } });
  }

  private async assertNotPosted(organizationId: string, id: string) {
    const run = await this.findOneOrThrow(organizationId, id);
    if (run.status === "POSTED") {
      throw new ConflictException("Esta folha já foi postada e não pode mais ser alterada.");
    }
    return run;
  }
}

interface PayrollTotals {
  baseSalary: number;
  netPay: number;
  inss: number;
  irrf: number;
  fgts: number;
  employerInss: number;
  mealVoucherBenefit: number;
  mealVoucherDiscount: number;
  transportVoucherDiscount: number;
}

/**
 * Débito = despesa bruta com salários + despesa com encargos patronais +
 * despesa líquida com benefícios. Crédito = líquido a pagar + INSS/IRRF
 * retidos + FGTS/INSS patronal a recolher + valor bruto de benefícios a
 * pagar ao fornecedor (incluindo o desconto de VT recuperado do
 * funcionário — este sistema não modela a compra do vale-transporte em si,
 * que é lançada à parte, ex. via Contas a Pagar; aqui só desviamos o valor
 * retido do líquido para a mesma conta de benefícios, funcionando como uma
 * conta de acerto). As duas contas de benefício só entram se algum valor
 * for diferente de zero, para não tentar postar uma linha de R$ 0,00
 * (trigger de "amount > 0" em journal_entry_lines).
 */
function buildPayrollJournalLines(
  settings: PayrollSettings,
  totals: PayrollTotals,
): { accountId: string; direction: LineDirection; amount: number }[] {
  const lines: { accountId: string; direction: LineDirection; amount: number }[] = [];

  const require = (accountId: string | null, label: string): string => {
    if (!accountId) {
      throw new BadRequestException(`Configure a conta contábil "${label}" em Configurações de Folha antes de postar.`);
    }
    return accountId;
  };

  lines.push({ accountId: require(settings.salaryExpenseAccountId, "Despesa com salários"), direction: "DEBIT", amount: totals.baseSalary });
  lines.push({ accountId: require(settings.salaryPayableAccountId, "Salários a pagar"), direction: "CREDIT", amount: totals.netPay });

  if (totals.inss > 0) {
    lines.push({ accountId: require(settings.inssPayableAccountId, "INSS a recolher"), direction: "CREDIT", amount: totals.inss });
  }
  if (totals.irrf > 0) {
    lines.push({ accountId: require(settings.irrfPayableAccountId, "IRRF a recolher"), direction: "CREDIT", amount: totals.irrf });
  }

  const employerCharges = totals.fgts + totals.employerInss;
  if (employerCharges > 0) {
    lines.push({
      accountId: require(settings.employerChargesExpenseAccountId, "Despesa com encargos patronais"),
      direction: "DEBIT",
      amount: employerCharges,
    });
  }
  if (totals.fgts > 0) {
    lines.push({ accountId: require(settings.fgtsPayableAccountId, "FGTS a recolher"), direction: "CREDIT", amount: totals.fgts });
  }
  if (totals.employerInss > 0) {
    lines.push({
      accountId: require(settings.employerInssPayableAccountId, "INSS patronal a recolher"),
      direction: "CREDIT",
      amount: totals.employerInss,
    });
  }

  const benefitsExpense = totals.mealVoucherBenefit - totals.mealVoucherDiscount;
  if (benefitsExpense > 0) {
    lines.push({
      accountId: require(settings.benefitsExpenseAccountId, "Despesa com benefícios"),
      direction: "DEBIT",
      amount: benefitsExpense,
    });
  }
  const benefitsPayable = totals.mealVoucherBenefit + totals.transportVoucherDiscount;
  if (benefitsPayable > 0) {
    lines.push({
      accountId: require(settings.benefitsPayableAccountId, "Benefícios a pagar"),
      direction: "CREDIT",
      amount: benefitsPayable,
    });
  }

  return lines;
}
