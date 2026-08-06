import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { CostCenter } from "../../types/accounting";
import type { BalanceSheetReport } from "../../types/reports";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Filters {
  asOfDate: string;
  costCenterId: string;
}

export function BalanceSheetTab() {
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });

  const [draft, setDraft] = useState<Filters>({ asOfDate: today(), costCenterId: "" });
  const [applied, setApplied] = useState<Filters>(draft);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "balance-sheet", applied],
    queryFn: () =>
      apiGet<BalanceSheetReport>(
        `/reports/balance-sheet?asOfDate=${applied.asOfDate}${applied.costCenterId ? `&costCenterId=${applied.costCenterId}` : ""}`,
      ),
  });

  const balanced = report ? Math.abs(report.totalAssets - (report.totalLiabilities + report.totalEquity)) < 0.01 : true;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Na data" type="date" value={draft.asOfDate} onChange={(e) => setDraft({ ...draft, asOfDate: e.target.value })} />
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
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-0">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Ativo</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {report.assets.map((l) => (
                  <tr key={l.accountId}>
                    <td className="px-4 py-2">
                      {l.code} — {l.name}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-800 text-sm font-medium">
                <tr>
                  <td className="px-4 py-3">Total do Ativo</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(report.totalAssets)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card className="p-0">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Passivo</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {report.liabilities.map((l) => (
                  <tr key={l.accountId}>
                    <td className="px-4 py-2">
                      {l.code} — {l.name}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-800 text-sm font-medium">
                <tr>
                  <td className="px-4 py-3">Total do Passivo</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(report.totalLiabilities)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="border-b border-t border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Patrimônio Líquido</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {report.equity.map((l) => (
                  <tr key={l.accountId}>
                    <td className="px-4 py-2">
                      {l.code} — {l.name}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2 text-slate-400">Resultado do período (não realizado)</td>
                  <td className="px-4 py-2 text-right text-slate-400">{formatCurrency(report.netIncome)}</td>
                </tr>
              </tbody>
              <tfoot className="border-t border-slate-800 text-sm font-medium">
                <tr>
                  <td className="px-4 py-3">Total do PL</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(report.totalEquity)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <div className={`col-span-2 rounded-lg border px-4 py-3 text-sm ${balanced ? "border-emerald-800 text-emerald-400" : "border-red-800 text-red-400"}`}>
            {balanced
              ? "Ativo = Passivo + Patrimônio Líquido"
              : `Divergência: Ativo ${formatCurrency(report.totalAssets)} ≠ Passivo + PL ${formatCurrency(report.totalLiabilities + report.totalEquity)}`}
          </div>
        </div>
      )}
    </div>
  );
}
