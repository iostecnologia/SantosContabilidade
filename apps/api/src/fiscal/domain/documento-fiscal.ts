/**
 * Camada de domínio do módulo de Lançamento de Documentos Fiscais — puro
 * TypeScript, sem dependência de Nest/Prisma. Cobre os documentos da
 * Reforma Tributária (EC 132/2023: CBS, IBS, Imposto Seletivo) e os modelos
 * tradicionais em transição, com os campos essenciais de retenção na fonte.
 */

export enum TipoDocumentoFiscal {
  // Reforma tributária (EC 132/2023)
  CBS = "CBS",
  IBS = "IBS",
  IMPOSTO_SELETIVO = "IMPOSTO_SELETIVO",
  // Modelos tradicionais em transição
  NFE = "NFE",
  NFSE_NACIONAL = "NFSE_NACIONAL",
  CTE = "CTE",
  CTE_OS = "CTE_OS",
  MDFE = "MDFE",
  BPE = "BPE",
  GTVE = "GTVE",
  NF3E = "NF3E",
  NFSE_VIA = "NFSE_VIA",
  DCE = "DCE",
  NFCE = "NFCE",
  NFCOM = "NFCOM",
  NFE_ABI = "NFE_ABI",
  NFAG = "NFAG",
  NFGAS = "NFGAS",
}

export enum NaturezaOperacaoFiscal {
  COMPRA_MERCADORIA = "COMPRA_MERCADORIA",
  COMPRA_ATIVO_IMOBILIZADO = "COMPRA_ATIVO_IMOBILIZADO",
  SERVICO_TOMADO = "SERVICO_TOMADO",
  SERVICO_PRESTADO = "SERVICO_PRESTADO",
  VENDA_MERCADORIA = "VENDA_MERCADORIA",
}

export interface ItemDocumentoFiscal {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Rateio explícito: se omitido, usa `centroCustoPadraoId` do documento. */
  centroCustoId?: string;
  /** Classificação fiscal — usada pela apuração automática de tributos (ver ApuracaoTributariaService). */
  ncm?: string;
  ufOrigem?: string;
  ufDestino?: string;
  codigoServicoMunicipal?: string;
}

/** Resultado da apuração automática — preenchido por ApuracaoTributariaService antes de contabilizar. */
export interface ImpostosApurados {
  icms?: number;
  pis?: number;
  cofins?: number;
  iss?: number;
  simplesNacionalDas?: number;
}

/** Retenções na fonte exigidas pelo tomador/comprador (Lei 9.711/98, IN RFB, reforma tributária). */
export interface Retencoes {
  irrf?: number;
  csll?: number;
  pis?: number;
  cofins?: number;
  iss?: number;
  inss?: number;
  cbsRetido?: number;
  ibsRetido?: number;
}

export interface DocumentoFiscal {
  id: string;
  tipo: TipoDocumentoFiscal;
  naturezaOperacao: NaturezaOperacaoFiscal;
  numeroDocumento: string;
  dataEmissao: string;
  dataCompetencia: string;
  fornecedorOuClienteId: string;
  valorTotal: number;
  /** Créditos tributários não-cumulativos recuperáveis pelo comprador (CBS/IBS destacados). */
  valorTributosRecuperaveis?: number;
  itens: ItemDocumentoFiscal[];
  retencoes?: Retencoes;
  centroCustoPadraoId?: string;
  /** Tributos próprios do EMISSOR sobre a venda/serviço prestado — não confundir com `retencoes` (retenção do tomador/comprador). */
  impostosApurados?: ImpostosApurados;
}
