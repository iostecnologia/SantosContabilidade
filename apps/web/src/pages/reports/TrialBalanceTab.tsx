import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { CostCenter } from "../../types/accounting";
import type { TrialBalanceReport } from "../../types/reports";

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

export function TrialBalanceTab() {
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });

  const [draft, setDraft] = useState<Filters>({ startDate: firstDayOfMonth(), endDate: today(), costCenterId: "" });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "trial-balance", applied],
    queryFn: () =>
      apiGet<TrialBalanceReport>(
        `/reports/trial-balance?startDate=${applied.startDate}&endDate=${applied.endDate}${applied.costCenterId ? `&costCenterId=${applied.costCenterId}` : ""}`,
      ),
  });

  const totals = report?.rows.reduce(
    (acc, r) => ({
      periodDebit: acc.periodDebit + r.periodDebit,
      periodCredit: acc.periodCredit + r.periodCredit,
    }),
    { periodDebit: 0, periodCredit: 0 },
  );

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

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3 text-right">Saldo anterior</th>
              <th className="px-4 py-3 text-right">Débito</th>
              <th className="px-4 py-3 text-right">Crédito</th>
              <th className="px-4 py-3 text-right">Saldo atual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {report?.rows.map((r) => (
              <tr key={r.accountId}>
                <td className="px-4 py-2">
                  {r.code} — {r.name}
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.openingBalance)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.periodDebit)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.periodCredit)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(r.closingBalance)}</td>
              </tr>
            ))}
            {report && report.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Sem movimento no período.
                </td>
              </tr>
            )}
          </tbody>
          {totals && report && report.rows.length > 0 && (
            <tfoot className="border-t border-slate-800 text-sm font-medium">
              <tr>
                <td className="px-4 py-3">Total do período</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{formatCurrency(totals.periodDebit)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.periodCredit)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
