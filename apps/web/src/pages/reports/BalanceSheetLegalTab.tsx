import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { BalanceSheetLegalReport, LegalGroupResult } from "../../types/reports";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BalanceSheetLegalTab() {
  const [draft, setDraft] = useState(today());
  const [applied, setApplied] = useState(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "balance-sheet-legal", applied],
    queryFn: () => apiGet<BalanceSheetLegalReport>(`/reports/balance-sheet-legal?asOfDate=${applied}`),
  });

  const balanced = report ? Math.abs(report.totalAtivo - report.totalPassivoMaisPatrimonioLiquido) < 0.01 : true;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Na data" type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button onClick={() => setApplied(draft)} disabled={isFetching}>
            {isFetching ? "Gerando..." : "Gerar"}
          </Button>
        </div>
      </Card>

      {report && report.contasSemClassificacao.length > 0 && (
        <Card>
          <p className="text-sm text-amber-400">
            Contas de ativo/passivo/PL sem grupo de demonstrativo legal atribuído (ficam fora deste relatório —
            classifique em Plano de Contas): {report.contasSemClassificacao.join(", ")}.
          </p>
        </Card>
      )}

      {report && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-0">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Ativo</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                <GroupRow group={report.ativoCirculante} />
                <SubtotalRow label="Total do Ativo Circulante" value={report.ativoCirculante.total} />
                <GroupRow group={report.ativoNaoCirculante.realizavelLongoPrazo} />
                <GroupRow group={report.ativoNaoCirculante.investimentos} />
                <GroupRow group={report.ativoNaoCirculante.imobilizado} />
                <GroupRow group={report.ativoNaoCirculante.intangivel} />
                <SubtotalRow label="Total do Ativo Não Circulante" value={report.ativoNaoCirculante.total} />
              </tbody>
              <tfoot className="border-t border-slate-800 text-sm font-medium">
                <tr className="bg-slate-800/40">
                  <td className="px-4 py-3 text-emerald-400">Total do Ativo</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(report.totalAtivo)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card className="p-0">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Passivo e Patrimônio Líquido</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                <GroupRow group={report.passivoCirculante} />
                <GroupRow group={report.passivoNaoCirculante} />
                <GroupRow group={report.patrimonioLiquido.capitalSocial} />
                <GroupRow group={report.patrimonioLiquido.reservasCapital} />
                <GroupRow group={report.patrimonioLiquido.ajustesAvaliacaoPatrimonial} />
                <GroupRow group={report.patrimonioLiquido.reservasLucros} />
                <GroupRow group={report.patrimonioLiquido.acoesTesouraria} />
                <GroupRow group={report.patrimonioLiquido.lucrosAcumulados} />
                <tr>
                  <td className="px-4 py-2 text-slate-400">Resultado do período (não apurado)</td>
                  <td className="px-4 py-2 text-right text-slate-400">
                    {formatCurrency(report.patrimonioLiquido.resultadoDoExercicio)}
                  </td>
                </tr>
                <SubtotalRow label="Total do Patrimônio Líquido" value={report.patrimonioLiquido.total} />
              </tbody>
              <tfoot className="border-t border-slate-800 text-sm font-medium">
                <tr className="bg-slate-800/40">
                  <td className="px-4 py-3 text-emerald-400">Total do Passivo + PL</td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {formatCurrency(report.totalPassivoMaisPatrimonioLiquido)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <div
            className={`col-span-2 rounded-lg border px-4 py-3 text-sm ${
              balanced ? "border-emerald-800 text-emerald-400" : "border-red-800 text-red-400"
            }`}
          >
            {balanced
              ? "Ativo = Passivo + Patrimônio Líquido"
              : `Divergência: Ativo ${formatCurrency(report.totalAtivo)} ≠ Passivo + PL ${formatCurrency(report.totalPassivoMaisPatrimonioLiquido)}`}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({ group }: { group: LegalGroupResult }) {
  return (
    <tr>
      <td className="px-4 py-2">
        <details>
          <summary className="cursor-pointer text-slate-300">{group.label}</summary>
          {group.lines.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-slate-500">
              {group.lines.map((l) => (
                <li key={l.accountId} className="flex justify-between gap-4">
                  <span>
                    {l.code} — {l.name}
                  </span>
                  <span>{formatCurrency(l.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 pl-4 text-xs text-slate-600">Sem saldo.</p>
          )}
        </details>
      </td>
      <td className="px-4 py-2 text-right align-top">{formatCurrency(group.total)}</td>
    </tr>
  );
}

function SubtotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="bg-slate-800/20">
      <td className="px-4 py-2 font-medium text-slate-200">{label}</td>
      <td className="px-4 py-2 text-right font-medium text-slate-200">{formatCurrency(value)}</td>
    </tr>
  );
}
