import { useState } from "react";
import { TrialBalanceTab } from "./TrialBalanceTab";
import { GeneralLedgerTab } from "./GeneralLedgerTab";
import { IncomeStatementTab } from "./IncomeStatementTab";
import { BalanceSheetTab } from "./BalanceSheetTab";

type TabKey = "trial-balance" | "general-ledger" | "income-statement" | "balance-sheet";

const TABS: { key: TabKey; label: string }[] = [
  { key: "trial-balance", label: "Balancete" },
  { key: "general-ledger", label: "Livro Razão" },
  { key: "income-statement", label: "DRE" },
  { key: "balance-sheet", label: "Balanço Patrimonial" },
];

export function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("trial-balance");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Relatórios</h1>

      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-emerald-500 text-emerald-400" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trial-balance" && <TrialBalanceTab />}
      {tab === "general-ledger" && <GeneralLedgerTab />}
      {tab === "income-statement" && <IncomeStatementTab />}
      {tab === "balance-sheet" && <BalanceSheetTab />}
    </div>
  );
}
