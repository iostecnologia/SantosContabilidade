import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter } from "../../types/accounting";
import type { GeneralLedgerReport } from "../../types/reports";

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
  accountId: string;
  startDate: string;
  endDate: string;
  costCenterId: string;
}

export function GeneralLedgerTab() {
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });
  const analyticAccounts = accounts.filter((a) => a.isAnalytic);

  const [draft, setDraft] = useState<Filters>({ accountId: "", startDate: firstDayOfMonth(), endDate: today(), costCenterId: "" });
  const [applied, setApplied] = useState<Filters | null>(null);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "general-ledger", applied],
    queryFn: () =>
      apiGet<GeneralLedgerReport>(
        `/reports/general-ledger/${applied!.accountId}?startDate=${applied!.startDate}&endDate=${applied!.endDate}${applied!.costCenterId ? `&costCenterId=${applied!.costCenterId}` : ""}`,
      ),
    enabled: !!applied?.accountId,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Conta" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
            <option value="">selecione</option>
            {analyticAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
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
          <Button onClick={() => setApplied(draft)} disabled={!draft.accountId || isFetching}>
            {isFetching ? "Gerando..." : "Gerar"}
          </Button>
        </div>
      </Card>

      {report && (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm">
            <span className="font-semibold text-slate-200">
              {report.account.code} — {report.account.name}
            </span>
            <span className="text-slate-400">Saldo anterior: {formatCurrency(report.openingBalance)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Débito</th>
                <th className="px-4 py-3 text-right">Crédito</th>
                <th className="px-4 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {report.rows.map((line) => (
                <tr key={line.journalEntryId}>
                  <td className="px-4 py-2 text-slate-500">{line.competenceDate.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-slate-500">{line.entryNumber}</td>
                  <td className="px-4 py-2">{line.description}</td>
                  <td className="px-4 py-2 text-right">{line.direction === "DEBIT" ? formatCurrency(line.amount) : ""}</td>
                  <td className="px-4 py-2 text-right">{line.direction === "CREDIT" ? formatCurrency(line.amount) : ""}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(line.runningBalance)}</td>
                </tr>
              ))}
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Sem movimento no período.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-800 text-sm font-medium">
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  Saldo final
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(report.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
