import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { UpdateFiscalTaxSettingsDto } from "./dto/update-fiscal-tax-settings.dto";
import { SetSimplesBracketsDto } from "./dto/set-simples-brackets.dto";
import { SetIcmsUfRatesDto } from "./dto/set-icms-uf-rates.dto";

// Anexo III (serviços em geral), faixas 1 a 3 — cobre receita bruta anual até
// R$ 720.000, a maioria das pequenas empresas de serviço. Faixas 4 a 6 (até
// R$ 4.800.000, com a regra do Fator R para desempate com o Anexo V) ficam
// de fora do seed por padrão — a tela de configuração é editável, adicione
// se precisar. Valores de referência: CONFIRA contra a tabela vigente da
// LC 123/2006 (com as alterações da LC 155/2016) antes de apurar de verdade.
const DEFAULT_SIMPLES_ANEXO_III_BRACKETS = [
  {
    rbt12Min: 0,
    rbt12Max: 180000,
    aliquotaNominal: 0.06,
    parcelaDeduzir: 0,
    percentualIrpj: 0.04,
    percentualCsll: 0.035,
    percentualCofins: 0.1282,
    percentualPis: 0.0278,
    percentualCpp: 0.434,
    percentualIcmsOuIss: 0.335,
  },
  {
    rbt12Min: 180000.01,
    rbt12Max: 360000,
    aliquotaNominal: 0.112,
    parcelaDeduzir: 9360,
    percentualIrpj: 0.04,
    percentualCsll: 0.035,
    percentualCofins: 0.1405,
    percentualPis: 0.0305,
    percentualCpp: 0.434,
    percentualIcmsOuIss: 0.32,
  },
  {
    rbt12Min: 360000.01,
    rbt12Max: 720000,
    aliquotaNominal: 0.135,
    parcelaDeduzir: 17640,
    percentualIrpj: 0.04,
    percentualCsll: 0.035,
    percentualCofins: 0.1364,
    percentualPis: 0.0296,
    percentualCpp: 0.434,
    percentualIcmsOuIss: 0.325,
  },
];

@Injectable()
export class FiscalTaxSettingsService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  async getOrCreate(organizationId: string) {
    const existing = await this.tx.fiscalTaxSettings.findFirst({
      where: { organizationId },
      include: { simplesBrackets: true, icmsUfRates: true },
    });
    if (existing) {
      return existing;
    }

    const created = await this.tx.fiscalTaxSettings.create({
      data: {
        organizationId,
        regimeTributario: "SIMPLES_NACIONAL",
        anexoSimplesNacional: "III",
        pisRate: 0.0065,
        cofinsRate: 0.03,
        issRate: 0.05,
        icmsDefaultInternalRate: 0.18,
      },
    });
    await this.tx.simplesNacionalBracket.createMany({
      data: DEFAULT_SIMPLES_ANEXO_III_BRACKETS.map((b) => ({
        ...b,
        organizationId,
        fiscalTaxSettingsId: created.id,
        anexo: "III" as const,
      })),
    });

    return this.tx.fiscalTaxSettings.findFirstOrThrow({
      where: { id: created.id },
      include: { simplesBrackets: true, icmsUfRates: true },
    });
  }

  async update(organizationId: string, dto: UpdateFiscalTaxSettingsDto) {
    const settings = await this.getOrCreate(organizationId);

    const accountFields = [
      "receitaVendasAccountId",
      "receitaServicosAccountId",
      "deducoesTributariasVendasAccountId",
      "deducoesTributariasServicosAccountId",
      "clientesAReceberAccountId",
      "icmsPayableAccountId",
      "pisPayableAccountId",
      "cofinsPayableAccountId",
      "issPayableAccountId",
      "simplesNacionalPayableAccountId",
    ] as const;
    for (const field of accountFields) {
      const accountId = dto[field];
      if (accountId) {
        await this.ensureAccountUsable(organizationId, accountId);
      }
    }

    await this.tx.fiscalTaxSettings.update({ where: { id: settings.id }, data: dto });
    return this.getOrCreate(organizationId);
  }

  async setSimplesBrackets(organizationId: string, dto: SetSimplesBracketsDto) {
    const settings = await this.getOrCreate(organizationId);

    await this.tx.simplesNacionalBracket.deleteMany({
      where: { organizationId, fiscalTaxSettingsId: settings.id, anexo: dto.anexo },
    });
    await this.tx.simplesNacionalBracket.createMany({
      data: dto.brackets.map((b) => ({
        ...b,
        organizationId,
        fiscalTaxSettingsId: settings.id,
        anexo: dto.anexo,
      })),
    });
    return this.getOrCreate(organizationId);
  }

  async setIcmsUfRates(organizationId: string, dto: SetIcmsUfRatesDto) {
    const settings = await this.getOrCreate(organizationId);
    const ufsInformados = new Set(dto.rates.map((r) => r.uf.toUpperCase()));
    if (ufsInformados.size !== dto.rates.length) {
      throw new BadRequestException("UF repetida na lista de alíquotas.");
    }

    await this.tx.icmsUfRate.deleteMany({ where: { organizationId, fiscalTaxSettingsId: settings.id } });
    await this.tx.icmsUfRate.createMany({
      data: dto.rates.map((r) => ({
        organizationId,
        fiscalTaxSettingsId: settings.id,
        uf: r.uf.toUpperCase(),
        internalRate: r.internalRate,
      })),
    });
    return this.getOrCreate(organizationId);
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
}
