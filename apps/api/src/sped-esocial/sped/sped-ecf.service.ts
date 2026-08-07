import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { formatarDataSped, formatarValorSped, juntarArquivoSped, montarLinhaSped } from "./sped.util";

interface SaldoRow {
  accountId: string;
  netDebit: number;
}

/**
 * Geração stateless da ECF — Bloco 0 (identificação) + Bloco J (plano de
 * contas/mapeamento referencial + apuração de resultado do exercício, no
 * mesmo espírito de ReportsService.incomeStatement) + Bloco 9. Os códigos de
 * registro do Bloco J usados aqui (J050/J051/J210/J215) seguem a MESMA
 * estrutura conceitual do leiaute oficial (plano de contas + mapeamento +
 * DRE), mas sem garantia de casar campo a campo com a versão vigente —
 * mesmo limite já assumido em SpedEcdService/SpedEfd*Service.
 *
 * DELIBERADAMENTE FORA DE ESCOPO: Blocos M/N (LALUR Parte A/B — adições,
 * exclusões e compensação de prejuízos fiscais). Este sistema não modela
 * ajustes do lucro real (nenhuma tabela de adição/exclusão/compensação
 * existe no schema); chutar esses valores teria consequência tributária
 * real, então o arquivo gerado aqui NÃO substitui a apuração do IRPJ/CSLL
 * feita pelo contador — ver `avisoLalur` no retorno.
 */
@Injectable()
export class SpedEcfService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async gerar(organizationId: string, year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Informe um ano-calendário válido.");
    }

    const organization = await this.tx.organization.findFirstOrThrow({ where: { id: organizationId } });
    const registration = await this.tx.companyRegistration.findFirst({ where: { organizationId } });
    const dtIni = new Date(Date.UTC(year, 0, 1));
    const dtFin = new Date(Date.UTC(year, 11, 31));

    const accounts = await this.tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
    const resultAccounts = accounts.filter((a) => a.isAnalytic && (a.type === "REVENUE" || a.type === "EXPENSE"));
    const contasSemMapeamentoReferencial = resultAccounts.filter((a) => !a.spedReferenceCode).map((a) => a.code);

    const rows = await this.tx.$queryRaw<SaldoRow[]>`
      SELECT jel.account_id AS "accountId",
        SUM(CASE WHEN jel.direction = 'DEBIT' THEN jel.amount ELSE -jel.amount END)::float8 AS "netDebit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE jel.organization_id = ${organizationId} AND a.type IN ('REVENUE', 'EXPENSE')
        AND je.competence_date BETWEEN ${dtIni}::date AND ${dtFin}::date
      GROUP BY jel.account_id
    `;
    const netDebitByAccount = new Map(rows.map((r) => [r.accountId, r.netDebit]));

    const linhas: string[] = [];
    linhas.push(montarLinhaSped(["0000", "ECF", formatarDataSped(dtIni), formatarDataSped(dtFin), organization.name, organization.taxId ?? "", "0"]));
    linhas.push(montarLinhaSped(["0001", "0"]));
    linhas.push(montarLinhaSped(["0010", registration?.legalNatureCode ?? ""]));
    linhas.push(montarLinhaSped(["0990", "4"]));

    linhas.push(montarLinhaSped(["J001", "0"]));
    for (const account of accounts) {
      linhas.push(montarLinhaSped(["J050", account.code, account.name, account.type]));
      if (account.spedReferenceCode) {
        linhas.push(montarLinhaSped(["J051", account.code, account.spedReferenceCode]));
      }
    }

    let totalReceitas = 0;
    let totalDespesas = 0;
    for (const account of resultAccounts) {
      const netDebit = netDebitByAccount.get(account.id) ?? 0;
      const valor = account.type === "REVENUE" ? -netDebit : netDebit;
      if (account.type === "REVENUE") totalReceitas += valor;
      else totalDespesas += valor;
      linhas.push(montarLinhaSped(["J210", account.code, account.spedReferenceCode ?? "", account.type, formatarValorSped(valor)]));
    }
    const resultadoExercicio = totalReceitas - totalDespesas;
    linhas.push(montarLinhaSped(["J215", formatarValorSped(totalReceitas), formatarValorSped(totalDespesas), formatarValorSped(resultadoExercicio)]));
    linhas.push(montarLinhaSped(["J990", (linhas.filter((l) => l.startsWith("|J")).length + 1).toString()]));

    linhas.push(montarLinhaSped(["9001", "0"]));
    linhas.push(montarLinhaSped(["9990", "2"]));
    linhas.push(montarLinhaSped(["9999", (linhas.length + 1).toString()]));

    return {
      nomeArquivo: `ECF-${organization.taxId ?? organization.id}-${year}.txt`,
      conteudo: juntarArquivoSped(linhas),
      contasSemMapeamentoReferencial,
      totalReceitas,
      totalDespesas,
      resultadoExercicio,
      avisoLalur:
        "Blocos M/N (LALUR Parte A/B — adições, exclusões e compensação de prejuízos fiscais) não foram gerados. Este sistema não apura ajustes do lucro real; o cálculo do IRPJ/CSLL devido precisa ser complementado manualmente antes da transmissão real da ECF.",
    };
  }
}
