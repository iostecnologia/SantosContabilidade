import { useState } from "react";
import { EmployeesTab } from "./EmployeesTab";
import { PayrollSettingsTab } from "./PayrollSettingsTab";
import { PayrollRunsTab } from "./PayrollRunsTab";
import { VacationsTab } from "./VacationsTab";
import { ThirteenthSalaryTab } from "./ThirteenthSalaryTab";
import { TerminationsTab } from "./TerminationsTab";

type TabKey = "employees" | "settings" | "payroll" | "vacations" | "thirteenth" | "terminations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "employees", label: "Funcionários" },
  { key: "payroll", label: "Folha de Pagamento" },
  { key: "vacations", label: "Férias" },
  { key: "thirteenth", label: "13º Salário" },
  { key: "terminations", label: "Rescisões" },
  { key: "settings", label: "Configurações" },
];

export function DepartamentoPessoalPage() {
  const [tab, setTab] = useState<TabKey>("employees");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Departamento Pessoal</h1>

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

      {tab === "employees" && <EmployeesTab />}
      {tab === "settings" && <PayrollSettingsTab />}
      {tab === "payroll" && <PayrollRunsTab />}
      {tab === "vacations" && <VacationsTab />}
      {tab === "thirteenth" && <ThirteenthSalaryTab />}
      {tab === "terminations" && <TerminationsTab />}
    </div>
  );
}
