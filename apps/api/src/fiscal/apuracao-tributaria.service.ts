import { BadRequestException, Injectable } from "@nestjs/common";
import { FiscalTaxSettingsService } from "./fiscal-tax-settings.service";
import { ImpostosApurados, NaturezaOperacaoFiscal } from "./domain/documento-fiscal";

// Só os campos que a apuração realmente usa — evita forçar o chamador
// (ex.: a pré-visualização, que não tem descrição/quantidade de um item de
// verdade) a montar um ItemDocumentoFiscal completo.
export interface ItemParaApuracao {
  valorTotal: number;
  ufOrigem?: string;
  ufDestino?: string;
}

// Resolução do Senado Federal nº 22/1989 — matriz de alíquota interestadual
// de ICMS, em vigor desde então (por isso embutida no código, não configurável):
// 7% de UF do Sul/Sudeste (exceto ES) para UF do Norte/Nordeste/Centro-Oeste/ES,
// 12% nas demais combinações interestaduais. Não cobre substituição
// tributária, FCP, redução de base de cálculo, nem o DIFAL de consumidor
// final não-contribuinte (EC 87/2015) — fora do escopo desta apuração.
const ORIGEM_7_PORCENTO = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
const DESTINO_7_PORCENTO = new Set([
  "AC", "AP", "AM", "PA", "RO", "RR", "TO",
  "AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE",
  "DF", "GO", "MT", "MS",
  "ES",
]);

function aliquotaInterestadual(ufOrigem: string, ufDestino: string): number {
  return ORIGEM_7_PORCENTO.has(ufOrigem) && DESTINO_7_PORCENTO.has(ufDestino) ? 0.07 : 0.12;
}

/**
 * Motor de cálculo automático de tributos — puro em relação ao restante do
 * módulo Fiscal (só lê FiscalTaxSettings, não persiste nada, não gera
 * lançamento). O resultado (`ImpostosApurados`) é o que alimenta
 * `documento.impostosApurados` antes de `FiscalLancamentoService.lancar`
 * escolher a estratégia de contabilização.
 */
@Injectable()
export class ApuracaoTributariaService {
  constructor(private readonly fiscalTaxSettings: FiscalTaxSettingsService) {}

  async apurar(
    organizationId: string,
    naturezaOperacao: NaturezaOperacaoFiscal,
    itens: ItemParaApuracao[],
  ): Promise<ImpostosApurados> {
    const settings = await this.fiscalTaxSettings.getOrCreate(organizationId);
    const valorTotal = itens.reduce((acc, item) => acc + item.valorTotal, 0);

    if (settings.regimeTributario === "SIMPLES_NACIONAL") {
      return { simplesNacionalDas: this.calcularDas(settings, valorTotal) };
    }

    // Lucro Presumido ou Lucro Real: PIS/COFINS são sempre calculados (regra
    // agregada configurável, sem apuração de créditos de insumos — ver
    // comentário de topo do schema.prisma).
    const pis = this.arredondar(valorTotal * Number(settings.pisRate));
    const cofins = this.arredondar(valorTotal * Number(settings.cofinsRate));

    if (naturezaOperacao === NaturezaOperacaoFiscal.VENDA_MERCADORIA) {
      const icms = this.calcularIcms(settings, itens);
      return { icms, pis, cofins };
    }
    if (naturezaOperacao === NaturezaOperacaoFiscal.SERVICO_PRESTADO) {
      const iss = this.arredondar(valorTotal * Number(settings.issRate));
      return { iss, pis, cofins };
    }
    // Compra/serviço tomado não apura tributo próprio aqui — são despesas
    // (ver estratégias existentes de serviço tomado/CBS-IBS).
    return {};
  }

  private calcularDas(settings: { receitaBruta12Meses: unknown; simplesBrackets: unknown[] }, valorTotal: number): number {
    const rbt12 = Number(settings.receitaBruta12Meses);
    if (rbt12 <= 0) {
      throw new BadRequestException(
        "Configure a receita bruta dos últimos 12 meses (RBT12) antes de apurar o Simples Nacional.",
      );
    }
    const brackets = settings.simplesBrackets as {
      rbt12Min: unknown;
      rbt12Max: unknown | null;
      aliquotaNominal: unknown;
      parcelaDeduzir: unknown;
    }[];
    if (brackets.length === 0) {
      throw new BadRequestException("Nenhuma faixa do Simples Nacional configurada para o anexo selecionado.");
    }

    const faixa = brackets.find((b) => {
      const min = Number(b.rbt12Min);
      const max = b.rbt12Max === null ? null : Number(b.rbt12Max);
      return rbt12 >= min && (max === null || rbt12 <= max);
    });
    if (!faixa) {
      throw new BadRequestException(
        `RBT12 de R$ ${rbt12.toFixed(2)} não se encaixa em nenhuma faixa configurada — adicione a faixa correspondente.`,
      );
    }

    // Alíquota efetiva = (RBT12 × alíquota nominal da faixa − parcela a
    // deduzir) / RBT12 — fórmula oficial da LC 123/2006, art. 18, §1º-A.
    const aliquotaEfetiva = (rbt12 * Number(faixa.aliquotaNominal) - Number(faixa.parcelaDeduzir)) / rbt12;
    return this.arredondar(valorTotal * aliquotaEfetiva);
  }

  private calcularIcms(
    settings: { icmsDefaultInternalRate: unknown; icmsUfRates: { uf: string; internalRate: unknown }[] },
    itens: ItemParaApuracao[],
  ): number {
    let total = 0;
    for (const item of itens) {
      const ufOrigem = item.ufOrigem?.toUpperCase();
      const ufDestino = item.ufDestino?.toUpperCase();
      let aliquota: number;
      if (ufOrigem && ufDestino && ufOrigem !== ufDestino) {
        aliquota = aliquotaInterestadual(ufOrigem, ufDestino);
      } else {
        const uf = ufDestino ?? ufOrigem;
        const custom = uf ? settings.icmsUfRates.find((r) => r.uf === uf) : undefined;
        aliquota = custom ? Number(custom.internalRate) : Number(settings.icmsDefaultInternalRate);
      }
      total += item.valorTotal * aliquota;
    }
    return this.arredondar(total);
  }

  private arredondar(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}
