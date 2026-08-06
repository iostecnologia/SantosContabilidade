import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { CostCenter } from "../../types/accounting";
import type { IncomeStatementReport } from "../../types/reports";

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
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
  costCenterId: string;
}

export function IncomeStatementTab() {
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });

  const [draft, setDraft] = useState<Filters>({ startDate: firstDayOfMonth(), endDate: today(), costCenterId: "" });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "income-statement", applied],
    queryFn: () =>
      apiGet<IncomeStatementReport>(
        `/reports/income-statement?startDate=${applied.startDate}&endDate=${applied.endDate}${applied.costCenterId ? `&costCenterId=${applied.costCenterId}` : ""}`,
      ),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="De" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          <Input label="Até" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          <Select
            label="Centro de custo (opcional)"
            value={draft.costCenterId}
            onChange={(e) => setDraft({ ...draft, costCenterId: e.target.value })}
          >
            <option value="">Todos</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </Select>
          <Button onClick={() => setApplied(draft)} disabled={isFetching}>
            {isFetching ? "Gerando..." : "Gerar"}
          </Button>
        </div>
      </Card>

      {report && (
        <Card className="p-0">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Receitas</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800">
              {report.revenue.map((l) => (
                <tr key={l.accountId}>
                  <td className="px-4 py-2">
                    {l.code} — {l.name}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(l.amount)}</td>
                </tr>
              ))}
              {report.revenue.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-slate-500">
                    Sem receitas no período.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-800 text-sm font-medium">
              <tr>
                <td className="px-4 py-3">Total de receitas</td>
                <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(report.totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="border-y border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Despesas</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800">
              {report.expense.map((l) => (
                <tr key={l.accountId}>
                  <td className="px-4 py-2">
                    {l.code} — {l.name}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(l.amount)}</td>
                </tr>
              ))}
              {report.expense.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-slate-500">
                    Sem despesas no período.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-800 text-sm font-medium">
              <tr>
                <td className="px-4 py-3">Total de despesas</td>
                <td className="px-4 py-3 text-right text-amber-400">{formatCurrency(report.totalExpense)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between px-4 py-4 text-base font-semibold">
            <span>Resultado do período</span>
            <span className={report.netResult >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCurrency(report.netResult)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
