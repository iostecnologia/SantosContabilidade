import { useState } from "react";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";

type TabKey = "users" | "roles";

const TABS: { key: TabKey; label: string }[] = [
  { key: "users", label: "Usuários" },
  { key: "roles", label: "Papéis" },
];

export function UsersPage() {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Usuários e Permissões</h1>

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

      {tab === "users" && <UsersTab />}
      {tab === "roles" && <RolesTab />}
    </div>
  );
}
