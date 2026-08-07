import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { IncomeStatementLegalReport, LegalGroupResult } from "../../types/reports";

function firstDayOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Filters {
  startDate: string;
  endDate: string;
}

export function IncomeStatementLegalTab() {
  const [draft, setDraft] = useState<Filters>({ startDate: firstDayOfYear(), endDate: today() });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "income-statement-legal", applied],
    queryFn: () => apiGet<IncomeStatementLegalReport>(`/reports/income-statement-legal?startDate=${applied.startDate}&endDate=${applied.endDate}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="De" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          <Input label="Até" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          <Button onClick={() => setApplied(draft)} disabled={isFetching}>
            {isFetching ? "Gerando..." : "Gerar"}
          </Button>
        </div>
      </Card>

      {report && report.contasSemClassificacao.length > 0 && (
        <Card>
          <p className="text-sm text-amber-400">
            Contas de receita/despesa sem grupo de demonstrativo legal atribuído (ficam fora deste relatório — classifique
            em Plano de Contas): {report.contasSemClassificacao.join(", ")}.
          </p>
        </Card>
      )}

      {report && (
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800">
              <GroupRow group={report.receitaBruta} />
              <GroupRow group={report.deducoesReceita} />
              <SubtotalRow label="Receita Líquida" value={report.receitaLiquida} />
              <GroupRow group={report.custoMercadoriasServicos} />
              <SubtotalRow label="Lucro Bruto" value={report.lucroBruto} />
              <GroupRow group={report.despesasVendas} />
              <GroupRow group={report.despesasAdministrativas} />
              <GroupRow group={report.outrasReceitasOperacionais} />
              <GroupRow group={report.outrasDespesasOperacionais} />
              <SubtotalRow label="Resultado Operacional" value={report.resultadoOperacional} />
              <GroupRow group={report.receitasFinanceiras} />
              <GroupRow group={report.despesasFinanceiras} />
              <SubtotalRow label="Resultado Antes dos Tributos" value={report.resultadoAntesTributos} />
              <GroupRow group={report.irpjCsll} />
              <SubtotalRow label="Resultado Após Tributos" value={report.resultadoAposTributos} />
              <GroupRow group={report.participacoes} />
              <SubtotalRow label="Lucro Líquido do Exercício" value={report.lucroLiquido} emphasize />
            </tbody>
          </table>
        </Card>
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
            <p className="mt-1 pl-4 text-xs text-slate-600">Sem movimento no período.</p>
          )}
        </details>
      </td>
      <td className="px-4 py-2 text-right align-top">{formatCurrency(group.total)}</td>
    </tr>
  );
}

function SubtotalRow({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <tr className={emphasize ? "bg-slate-800/40" : "bg-slate-800/20"}>
      <td className={`px-4 py-2 font-medium ${emphasize ? "text-emerald-400" : "text-slate-200"}`}>{label}</td>
      <td className={`px-4 py-2 text-right font-medium ${emphasize ? "text-emerald-400" : "text-slate-200"}`}>
        {formatCurrency(value)}
      </td>
    </tr>
  );
}
