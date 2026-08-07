import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { CashFlowCategory, CashFlowReport } from "../../types/reports";

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
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

export function CashFlowTab() {
  const [draft, setDraft] = useState<Filters>({ startDate: firstDayOfMonth(), endDate: today() });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "cash-flow", applied],
    queryFn: () => apiGet<CashFlowReport>(`/reports/cash-flow?startDate=${applied.startDate}&endDate=${applied.endDate}`),
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

      {report && report.contasCaixa.length === 0 && (
        <Card>
          <p className="text-sm text-amber-400">
            Nenhuma conta bancária ou de caixa cadastrada — não há "caixa e equivalentes de caixa" para apurar. Cadastre
            uma conta em Financeiro antes de gerar este relatório.
          </p>
        </Card>
      )}

      {report && report.contasCaixa.length > 0 && (
        <>
          <Card>
            <p className="text-sm text-amber-400">
              DFC simplificada pelo método direto. Contas consideradas caixa: {report.contasCaixa.map((c) => c.name).join(", ")}.
              A classificação entre Operacional/Investimento/Financiamento é aproximada (Ativo Imobilizado vira
              Investimento, contrapartida em conta de Patrimônio Líquido vira Financiamento, o restante cai em
              Operacional) — confira antes de usar, principalmente lançamentos manuais de empréstimo.
            </p>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Saldo inicial" value={report.openingBalance} />
            <SummaryCard label="Variação do período" value={report.netChange} highlight />
            <SummaryCard label="Saldo final" value={report.closingBalance} />
          </div>

          <CategoryCard title="Atividades Operacionais" category={report.operating} />
          <CategoryCard title="Atividades de Investimento" category={report.investing} />
          <CategoryCard title="Atividades de Financiamento" category={report.financing} />
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? (value >= 0 ? "text-emerald-400" : "text-red-400") : "text-slate-100"}`}>
        {formatCurrency(value)}
      </p>
    </Card>
  );
}

function CategoryCard({ title, category }: { title: string; category: CashFlowCategory }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className={`text-sm font-medium ${category.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {formatCurrency(category.total)}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Nº</th>
            <th className="px-4 py-2">Data</th>
            <th className="px-4 py-2">Descrição</th>
            <th className="px-4 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {category.lines.map((l) => (
            <tr key={l.journalEntryId}>
              <td className="px-4 py-2 text-slate-400">{l.entryNumber}</td>
              <td className="px-4 py-2 text-slate-400">{l.entryDate.slice(0, 10)}</td>
              <td className="px-4 py-2">{l.description}</td>
              <td className={`px-4 py-2 text-right ${l.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(l.amount)}
              </td>
            </tr>
          ))}
          {category.lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                Nenhuma movimentação nesta categoria no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
