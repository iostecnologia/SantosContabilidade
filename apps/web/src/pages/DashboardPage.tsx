import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api-client";
import { Card } from "../components/ui/Card";
import type { Account, CostCenter, JournalEntry } from "../types/accounting";

function sumDebits(entries: JournalEntry[]): number {
  return entries.reduce(
    (total, entry) =>
      total + entry.lines.filter((l) => l.direction === "DEBIT").reduce((s, l) => s + Number(l.amount), 0),
    0,
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DashboardPage() {
  const costCentersQuery = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const entriesQuery = useQuery({ queryKey: ["journal-entries"], queryFn: () => apiGet<JournalEntry[]>("/journal-entries") });

  const entries = entriesQuery.data ?? [];
  const now = new Date();
  const entriesThisMonth = entries.filter((e) => {
    const d = new Date(e.entryDate);
    return d.getUTCFullYear() === now.getFullYear() && d.getUTCMonth() === now.getMonth();
  });
  const recentEntries = entries.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-slate-500">Contas contábeis</p>
          <p className="mt-1 text-2xl font-semibold">{accountsQuery.data?.length ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Centros de custo</p>
          <p className="mt-1 text-2xl font-semibold">{costCentersQuery.data?.length ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Lançamentos no mês</p>
          <p className="mt-1 text-2xl font-semibold">{entriesThisMonth.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Total debitado no mês</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(sumDebits(entriesThisMonth))}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Últimos lançamentos</h2>
          <Link to="/journal-entries" className="text-xs text-emerald-400 hover:underline">
            ver todos
          </Link>
        </div>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum lançamento ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800">
            {recentEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">
                  #{entry.entryNumber} — {entry.description}
                </span>
                <span className="text-slate-500">{entry.entryDate.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
