import { useState } from "react";
import { CompanyRegistrationTab } from "./CompanyRegistrationTab";
import { EsocialEventosTab } from "./EsocialEventosTab";
import { SpedFilesTab } from "./SpedFilesTab";

type TabKey = "cadastro" | "esocial" | "sped";

const TABS: { key: TabKey; label: string }[] = [
  { key: "cadastro", label: "Cadastro da Empresa" },
  { key: "esocial", label: "Eventos eSocial" },
  { key: "sped", label: "Arquivos SPED" },
];

export function SpedEsocialPage() {
  const [tab, setTab] = useState<TabKey>("cadastro");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">SPED e eSocial</h1>

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

      {tab === "cadastro" && <CompanyRegistrationTab />}
      {tab === "esocial" && <EsocialEventosTab />}
      {tab === "sped" && <SpedFilesTab />}
    </div>
  );
}
