import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { PayrollSettingsService } from "./payroll-settings.service";
import { CreateThirteenthSalaryRunDto } from "./dto/create-thirteenth-salary-run.dto";
import { calculateProgressiveTax, countWorkedMonthsInYear, toTaxBracketInputs } from "./payroll-calculation.util";

/**
 * 13º salário: uma rodada por ano+parcela (1ª, 2ª ou única). A 1ª parcela é
 * isenta de INSS/IRRF por lei (adiantamento) e, nesta implementação, também
 * não gera FGTS/INSS patronal próprios — os encargos do ano inteiro são
 * calculados de uma vez na 2ª parcela/parcela única sobre o valor total
 * (evita contar FGTS duas vezes entre as duas parcelas).
 */
@Injectable()
export class ThirteenthSalaryRunService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly payrollSettings: PayrollSettingsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.thirteenthSalaryRun.findMany({
      where: { organizationId },
      orderBy: [{ year: "desc" }, { installment: "asc" }],
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const run = await this.tx.thirteenthSalaryRun.findFirst({
      where: { id, organizationId },
      include: { lines: { include: { employee: true } } },
    });
    if (!run) {
      throw new NotFoundException("Rodada de 13º salário não encontrada.");
    }
    return run;
  }

  async create(organizationId: string, userId: string, dto: CreateThirteenthSalaryRunDto) {
    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'thirteenth_salary_run', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número da rodada.");
    }

    try {
      const run = await this.tx.thirteenthSalaryRun.create({
        data: {
          organizationId,
          runNumber: counterRows[0].current_value,
          year: dto.year,
          installment: dto.installment,
          createdBy: userId,
        },
      });
      return this.findOneOrThrow(organizationId, run.id);
    } catch {
      throw new ConflictException("Já existe uma rodada desta parcela para este ano.");
    }
  }

  async calculate(organizationId: string, id: string) {
    const run = await this.assertNotPosted(organizationId, id);
    const settings = await this.payrollSettings.getOrCreate(organizationId);
    const inssBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "INSS"));
    const irrfBrackets = toTaxBracketInputs(settings.taxBrackets.filter((b) => b.type === "IRRF"));

    const yearEnd = new Date(Date.UTC(run.year, 11, 31));
    const employees = await this.tx.employee.findMany({
      where: { organizationId, status: "ACTIVE", admissionDate: { lte: yearEnd } },
    });

    const firstInstallmentRun =
      run.installment === "SECOND"
        ? await this.tx.thirteenthSalaryRun.findFirst({
            where: { organizationId, year: run.year, installment: "FIRST" },
            include: { lines: true },
          })
        : null;

    await this.tx.thirteenthSalaryRunLine.deleteMany({ where: { thirteenthSalaryRunId: id } });

    for (const employee of employees) {
      const baseSalary = Number(employee.baseSalary);
      const monthsWorked = countWorkedMonthsInYear(employee.admissionDate, run.year, null);
      const proportionalTotal = baseSalary * (monthsWorked / 12);

      if (run.installment === "FIRST") {
        const grossAmount = proportionalTotal / 2;
        await this.tx.thirteenthSalaryRunLine.create({
          data: {
            organizationId,
            thirteenthSalaryRunId: id,
            employeeId: employee.id,
            monthsWorked,
            grossAmount,
            netPay: grossAmount,
          },
        });
        continue;
      }

      // SECOND ou SINGLE: incide INSS/IRRF/FGTS/INSS patronal sobre o valor
      // total do ano (não sobre a diferença) — a 1ª parcela já paga só é
      // abatida do líquido final, nunca da base de cálculo dos encargos.
      const grossAmount = proportionalTotal;
      const inssAmount = Math.min(calculateProgressiveTax(grossAmount, inssBrackets), Number(settings.inssCeiling));
      const irrfBase = grossAmount - inssAmount - employee.dependentsCount * Number(settings.irrfDependentDeduction);
      const irrfAmount = calculateProgressiveTax(irrfBase, irrfBrackets);
      const fgtsAmount = grossAmount * Number(settings.fgtsRate);
      const employerInssAmount = grossAmount * Number(settings.employerInssRate);
      const previousInstallmentAmount = Number(
        firstInstallmentRun?.lines.find((l) => l.employeeId === employee.id)?.netPay ?? 0,
      );
      const netPay = grossAmount - inssAmount - irrfAmount - previousInstallmentAmount;

      await this.tx.thirteenthSalaryRunLine.create({
        data: {
          organizationId,
          thirteenthSalaryRunId: id,
          employeeId: employee.id,
          monthsWorked,
          grossAmount,
          previousInstallmentAmount,
          inssAmount,
          irrfAmount,
          fgtsAmount,
          employerInssAmount,
          netPay,
        },
      });
    }

    await this.tx.thirteenthSalaryRun.update({ where: { id }, data: { status: "CALCULATED" } });
    return this.findOneOrThrow(organizationId, id);
  }

  async post(organizationId: string, userId: string, id: string) {
    const run = await this.findOneOrThrow(organizationId, id);
    if (run.status !== "CALCULATED") {
      throw new ConflictException("A rodada precisa estar calculada antes de ser postada.");
    }
    if (run.lines.length === 0) {
      throw new BadRequestException("Rodada sem nenhuma linha calculada.");
    }
    const settings = await this.payrollSettings.getOrCreate(organizationId);

    const totals = run.lines.reduce(
      (acc, line) => ({
        gross: acc.gross + Number(line.grossAmount),
        netPay: acc.netPay + Number(line.netPay),
        inss: acc.inss + Number(line.inssAmount),
        irrf: acc.irrf + Number(line.irrfAmount),
        fgts: acc.fgts + Number(line.fgtsAmount),
        employerInss: acc.employerInss + Number(line.employerInssAmount),
      }),
      { gross: 0, netPay: 0, inss: 0, irrf: 0, fgts: 0, employerInss: 0 },
    );

    const require = (accountId: string | null, label: string): string => {
      if (!accountId) {
        throw new BadRequestException(`Configure a conta contábil "${label}" em Configurações de Folha antes de postar.`);
      }
      return accountId;
    };

    const lines = [
      { accountId: require(settings.salaryExpenseAccountId, "Despesa com salários"), direction: "DEBIT" as const, amount: totals.gross },
      { accountId: require(settings.salaryPayableAccountId, "Salários a pagar"), direction: "CREDIT" as const, amount: totals.netPay },
    ];
    if (totals.inss > 0) {
      lines.push({ accountId: require(settings.inssPayableAccountId, "INSS a recolher"), direction: "CREDIT" as const, amount: totals.inss });
    }
    if (totals.irrf > 0) {
      lines.push({ accountId: require(settings.irrfPayableAccountId, "IRRF a recolher"), direction: "CREDIT" as const, amount: totals.irrf });
    }
    const employerCharges = totals.fgts + totals.employerInss;
    if (employerCharges > 0) {
      lines.push({
        accountId: require(settings.employerChargesExpenseAccountId, "Despesa com encargos patronais"),
        direction: "DEBIT" as const,
        amount: employerCharges,
      });
    }
    if (totals.fgts > 0) {
      lines.push({ accountId: require(settings.fgtsPayableAccountId, "FGTS a recolher"), direction: "CREDIT" as const, amount: totals.fgts });
    }
    if (totals.employerInss > 0) {
      lines.push({
        accountId: require(settings.employerInssPayableAccountId, "INSS patronal a recolher"),
        direction: "CREDIT" as const,
        amount: totals.employerInss,
      });
    }

    const installmentLabel = { FIRST: "1ª parcela", SECOND: "2ª parcela", SINGLE: "parcela única" }[run.installment];
    const entryDate = run.installment === "FIRST" ? `${run.year}-11-30` : `${run.year}-12-20`;

    const entry = await this.journalEntries.create(organizationId, userId, {
      entryDate,
      competenceDate: entryDate,
      description: `13º salário ${run.year} — ${installmentLabel} — nº ${run.runNumber}`,
      referenceModule: "PAYROLL_THIRTEENTH",
      referenceId: run.id,
      lines,
    });

    await this.tx.thirteenthSalaryRun.update({
      where: { id },
      data: { status: "POSTED", journalEntryId: entry.id, postedAt: new Date() },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.assertNotPosted(organizationId, id);
    await this.tx.thirteenthSalaryRunLine.deleteMany({ where: { thirteenthSalaryRunId: id } });
    await this.tx.thirteenthSalaryRun.delete({ where: { id } });
  }

  private async assertNotPosted(organizationId: string, id: string) {
    const run = await this.findOneOrThrow(organizationId, id);
    if (run.status === "POSTED") {
      throw new ConflictException("Esta rodada já foi postada e não pode mais ser alterada.");
    }
    return run;
  }
}
