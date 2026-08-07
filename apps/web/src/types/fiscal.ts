export type RegimeTributario = "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
export type AnexoSimplesNacional = "I" | "II" | "III" | "IV" | "V";
export type PisCofinsRegime = "CUMULATIVO" | "NAO_CUMULATIVO";

export interface SimplesNacionalBracket {
  id: string;
  anexo: AnexoSimplesNacional;
  rbt12Min: string;
  rbt12Max: string | null;
  aliquotaNominal: string;
  parcelaDeduzir: string;
  percentualIrpj: string;
  percentualCsll: string;
  percentualCofins: string;
  percentualPis: string;
  percentualCpp: string;
  percentualIcmsOuIss: string;
}

export interface IcmsUfRate {
  id: string;
  uf: string;
  internalRate: string;
}

export interface FiscalTaxSettings {
  id: string;
  organizationId: string;
  regimeTributario: RegimeTributario;
  anexoSimplesNacional: AnexoSimplesNacional | null;
  receitaBruta12Meses: string;
  pisCofinsRegime: PisCofinsRegime | null;
  pisRate: string;
  cofinsRate: string;
  issRate: string;
  icmsDefaultInternalRate: string;
  receitaVendasAccountId: string | null;
  receitaServicosAccountId: string | null;
  deducoesTributariasVendasAccountId: string | null;
  deducoesTributariasServicosAccountId: string | null;
  clientesAReceberAccountId: string | null;
  icmsPayableAccountId: string | null;
  pisPayableAccountId: string | null;
  cofinsPayableAccountId: string | null;
  issPayableAccountId: string | null;
  simplesNacionalPayableAccountId: string | null;
  simplesBrackets: SimplesNacionalBracket[];
  icmsUfRates: IcmsUfRate[];
}

export interface UpdateFiscalTaxSettingsInput {
  regimeTributario?: RegimeTributario;
  anexoSimplesNacional?: AnexoSimplesNacional;
  receitaBruta12Meses?: number;
  pisCofinsRegime?: PisCofinsRegime;
  pisRate?: number;
  cofinsRate?: number;
  issRate?: number;
  icmsDefaultInternalRate?: number;
  receitaVendasAccountId?: string;
  receitaServicosAccountId?: string;
  deducoesTributariasVendasAccountId?: string;
  deducoesTributariasServicosAccountId?: string;
  clientesAReceberAccountId?: string;
  icmsPayableAccountId?: string;
  pisPayableAccountId?: string;
  cofinsPayableAccountId?: string;
  issPayableAccountId?: string;
  simplesNacionalPayableAccountId?: string;
}

export type TipoDocumentoFiscal =
  | "NFE"
  | "NFCE"
  | "NFSE_NACIONAL"
  | "NFSE_VIA"
  | "CBS"
  | "IBS";

export type NaturezaOperacaoFiscal =
  | "COMPRA_MERCADORIA"
  | "COMPRA_ATIVO_IMOBILIZADO"
  | "SERVICO_TOMADO"
  | "SERVICO_PRESTADO"
  | "VENDA_MERCADORIA";

export interface ItemDocumentoFiscalInput {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ncm?: string;
  ufOrigem?: string;
  ufDestino?: string;
  codigoServicoMunicipal?: string;
}

export interface ImpostosApurados {
  icms?: number;
  pis?: number;
  cofins?: number;
  iss?: number;
  simplesNacionalDas?: number;
}

export interface ApurarTributosInput {
  naturezaOperacao: NaturezaOperacaoFiscal;
  itens: { valorTotal: number; ncm?: string; ufOrigem?: string; ufDestino?: string; codigoServicoMunicipal?: string }[];
}

export interface EmitirDocumentoInput {
  documento: {
    id: string;
    tipo: TipoDocumentoFiscal;
    naturezaOperacao: NaturezaOperacaoFiscal;
    numeroDocumento: string;
    dataEmissao: string;
    dataCompetencia: string;
    fornecedorOuClienteId: string;
    valorTotal: number;
    itens: ItemDocumentoFiscalInput[];
    centroCustoPadraoId?: string;
  };
  mapeamentoContabil: Record<string, string>;
}

export interface FiscalDocumentoEmitido {
  id: string;
  organizationId: string;
  tipo: TipoDocumentoFiscal;
  naturezaOperacao: NaturezaOperacaoFiscal;
  numeroDocumento: string;
  dataEmissao: string;
  dataCompetencia: string;
  contraparteId: string;
  valorTotal: string;
  documentoJson: EmitirDocumentoInput["documento"] & { impostosApurados?: ImpostosApurados };
  journalEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface FiscalXmlResponse {
  nomeArquivo: string;
  conteudo: string;
}
