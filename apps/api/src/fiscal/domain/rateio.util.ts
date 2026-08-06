import { ItemDocumentoFiscal } from "./documento-fiscal";

export interface GrupoRateio {
  centroCustoId?: string;
  valor: number;
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Rateia `valorARatear` entre os centros de custo dos itens do documento,
 * proporcionalmente ao peso de cada item no valor total. O resíduo de
 * arredondamento (centavos) é sempre absorvido pelo ÚLTIMO grupo, para que
 * a soma dos grupos bata exatamente com `valorARatear` — a constraint
 * trigger de partida dobrada no banco não tolera diferença de centavos.
 */
export function ratearPorCentroCusto(
  itens: ItemDocumentoFiscal[],
  valorARatear: number,
  centroCustoPadraoId?: string,
): GrupoRateio[] {
  const valorTotal = arredondar(valorARatear);
  if (valorTotal === 0) {
    return [];
  }

  const totalItens = itens.reduce((acc, item) => acc + item.valorTotal, 0);
  if (itens.length === 0 || totalItens <= 0) {
    return [{ centroCustoId: centroCustoPadraoId, valor: valorTotal }];
  }

  const SEM_CENTRO_CUSTO = "__sem_centro_custo__";
  const pesoPorGrupo = new Map<string, number>();
  for (const item of itens) {
    const chave = item.centroCustoId ?? centroCustoPadraoId ?? SEM_CENTRO_CUSTO;
    pesoPorGrupo.set(chave, (pesoPorGrupo.get(chave) ?? 0) + item.valorTotal);
  }

  const entradas = Array.from(pesoPorGrupo.entries());
  const resultado: GrupoRateio[] = [];
  let acumulado = 0;

  entradas.forEach(([chave, pesoGrupo], index) => {
    const centroCustoId = chave === SEM_CENTRO_CUSTO ? undefined : chave;
    const ehUltimo = index === entradas.length - 1;
    const valor = ehUltimo ? arredondar(valorTotal - acumulado) : arredondar((pesoGrupo / totalItens) * valorTotal);
    acumulado = arredondar(acumulado + valor);
    resultado.push({ centroCustoId, valor });
  });

  return resultado.filter((grupo) => grupo.valor !== 0);
}
