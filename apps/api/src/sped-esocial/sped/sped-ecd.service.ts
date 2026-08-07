import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { formatarDataSped, formatarValorSped, juntarArquivoSped, montarLinhaSped } from "./sped.util";

interface SaldoRow {
  accountId: string;
  netDebit: number;
}

interface SaldoCentroCustoRow {
  accountId: string;
  costCenterId: string | null;
  netDebit: number;
}

/**
 * Geração stateless da ECD (Bloco I — Lançamentos Contábeis), no mesmo
 * espírito do ReportsService: nada é persistido, tudo é recalculado a cada
 * chamada a partir de accounts/journal_entries/journal_entry_lines. Cobre só
 * o Bloco I (I001/I010/I030/I050/I051/I150/I155/I200/I250/I990) — Bloco 0
 * (abertura do arquivo) e Bloco 9 (encerramento) são incluídos como
 * envelope mínimo para o arquivo abrir num validador, mas Bloco J
 * (Demonstrações Contábeis dentro da própria ECD) fica de fora desta fatia,
 * consistente com a decisão já tomada de não modelar aqui a Demonstração de
 * Resultado formatada — ver ReportsService.incomeStatement para o
 * equivalente em tela.
 */
@Injectable()
export class SpedEcdService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async gerar(organizationId: string, year: number): Promise<{ nomeArquivo: string; conteudo: string; contasSemMapeamentoReferencial: string[] }> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Informe um ano-calendário válido.");
    }
    const organization = await this.tx.organization.findFirstOrThrow({ where: { id: organizationId } });
    const dtIni = new Date(Date.UTC(year, 0, 1));
    const dtFin = new Date(Date.UTC(year, 11, 31));

    const accounts = await this.tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
    const analyticAccounts = accounts.filter((a) => a.isAnalytic);
    const contasSemMapeamentoReferencial = analyticAccounts.filter((a) => !a.spedReferenceCode).map((a) => a.code);

    const openingRows = await this.tx.$queryRaw<SaldoRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId} AND je.competence_date < ${dtIni}::date
      GROUP BY jel.account_id
    `;
    const periodRows = await this.tx.$queryRaw<{ accountId: string; periodDebit: number; periodCredit: number }[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE 0 END)::float8 AS "periodDebit",
        SUM(CASE WHEN jel.direction = 'CREDIT' THEN jel.amount ELSE 0 END)::float8 AS "periodCredit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId} AND je.competence_date BETWEEN ${dtIni}::date AND ${dtFin}::date
      GROUP BY jel.account_id
    `;
    const costCenterRows = await this.tx.$queryRaw<SaldoCentroCustoRow[]>`
      SELECT jel.account_id AS "accountId", jel.cost_center_id AS "costCenterId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.organization_id = ${organizationId} AND je.competence_date BETWEEN ${dtIni}::date AND ${dtFin}::date
        AND jel.cost_center_id IS NOT NULL
      GROUP BY jel.account_id, jel.cost_center_id
    `;

    const entries = await this.tx.journalEntry.findMany({
      where: { organizationId, competenceDate: { gte: dtIni, lte: dtFin } },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
      orderBy: { entryNumber: "asc" },
    });

    const openingByAccount = new Map(openingRows.map((r) => [r.accountId, r.netDebit]));
    const periodByAccount = new Map(periodRows.map((r) => [r.accountId, r]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const linhas: string[] = [];
    linhas.push(montarLinhaSped(["0000", "LECD", formatarDataSped(dtIni), formatarDataSped(dtFin), organization.name, organization.taxId ?? "", "", "", "", "", "", "1"]));
    linhas.push(montarLinhaSped(["0001", "0"]));
    linhas.push(montarLinhaSped(["I001", "0"]));
    linhas.push(montarLinhaSped(["I010", "G", "CONTABIL"]));
    linhas.push(montarLinhaSped(["I030", `Termo de abertura ${year} — gerado para conferência, não enviado`]));

    for (const account of accounts) {
      linhas.push(montarLinhaSped(["I050", formatarDataSped(dtIni), account.type === "ASSET" || account.type === "EXPENSE" ? "D" : "C", account.isAnalytic ? "A" : "S", account.code, account.parentId ? accountById.get(account.parentId)?.code ?? "" : "", account.name]));
      if (account.spedReferenceCode) {
        linhas.push(montarLinhaSped(["I051", account.code, account.spedReferenceCode]));
      }
    }

    for (const account of analyticAccounts) {
      const openingNetDebit = openingByAccount.get(account.id) ?? 0;
      const period = periodByAccount.get(account.id) ?? { periodDebit: 0, periodCredit: 0 };
      const closingNetDebit = openingNetDebit + period.periodDebit - period.periodCredit;
      linhas.push(
        montarLinhaSped([
          "I150",
          account.code,
          formatarDataSped(dtIni),
          formatarDataSped(dtFin),
          formatarValorSped(Math.abs(openingNetDebit)),
          openingNetDebit >= 0 ? "D" : "C",
          formatarValorSped(period.periodDebit),
          formatarValorSped(period.periodCredit),
          formatarValorSped(Math.abs(closingNetDebit)),
          closingNetDebit >= 0 ? "D" : "C",
        ]),
      );
    }

    for (const row of costCenterRows) {
      const account = accountById.get(row.accountId);
      if (!account || !row.costCenterId) continue;
      linhas.push(
        montarLinhaSped(["I155", account.code, row.costCenterId, formatarValorSped(Math.abs(row.netDebit)), row.netDebit >= 0 ? "D" : "C"]),
      );
    }

    for (const entry of entries) {
      linhas.push(montarLinhaSped(["I200", entry.entryNumber.toString(), formatarDataSped(entry.entryDate), formatarValorSped(entry.lines.reduce((s, l) => (l.direction === "DEBIT" ? s + Number(l.amount) : s), 0)), "N"]));
      for (const line of entry.lines) {
        const account = accountById.get(line.accountId);
        linhas.push(
          montarLinhaSped([
            "I250",
            entry.entryNumber.toString(),
            account?.code ?? "",
            line.costCenterId ?? "",
            formatarValorSped(Number(line.amount)),
            line.direction === "DEBIT" ? "D" : "C",
            entry.description,
          ]),
        );
      }
    }

    linhas.push(montarLinhaSped(["I990", (linhas.filter((l) => l.startsWith("|I")).length + 1).toString()]));
    linhas.push(montarLinhaSped(["9001", "0"]));
    linhas.push(montarLinhaSped(["9990", "2"]));
    linhas.push(montarLinhaSped(["9999", (linhas.length + 1).toString()]));

    return {
      nomeArquivo: `ECD-${organization.taxId ?? organization.id}-${year}.txt`,
      conteudo: juntarArquivoSped(linhas),
      contasSemMapeamentoReferencial,
    };
  }
}
