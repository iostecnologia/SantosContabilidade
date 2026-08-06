import { useState } from "react";
import { CounterpartiesTab } from "./CounterpartiesTab";
import { BankAccountsTab } from "./BankAccountsTab";
import { AccountsPayableTab } from "./AccountsPayableTab";
import { AccountsReceivableTab } from "./AccountsReceivableTab";

type TabKey = "counterparties" | "bank-accounts" | "payable" | "receivable";

const TABS: { key: TabKey; label: string }[] = [
  { key: "payable", label: "Contas a Pagar" },
  { key: "receivable", label: "Contas a Receber" },
  { key: "counterparties", label: "Contrapartes" },
  { key: "bank-accounts", label: "Contas Bancárias" },
];

export function FinanceiroPage() {
  const [tab, setTab] = useState<TabKey>("payable");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Financeiro</h1>

      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "payable" && <AccountsPayableTab />}
      {tab === "receivable" && <AccountsReceivableTab />}
      {tab === "counterparties" && <CounterpartiesTab />}
      {tab === "bank-accounts" && <BankAccountsTab />}
    </div>
  );
}
