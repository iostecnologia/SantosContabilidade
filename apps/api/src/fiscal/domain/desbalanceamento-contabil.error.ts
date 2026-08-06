import { UnprocessableEntityException } from "@nestjs/common";

/**
 * Lançada quando uma estratégia de contabilização gera um rascunho cuja
 * soma de débitos difere da soma de créditos — nunca deveria acontecer se a
 * estratégia estiver correta, mas é checado explicitamente antes de
 * qualquer persistência (ver ContextoContabilFiscal.gerarRascunho).
 */
export class DesbalanceamentoContabilError extends UnprocessableEntityException {
  constructor(mensagem: string) {
    super(mensagem);
  }
}
