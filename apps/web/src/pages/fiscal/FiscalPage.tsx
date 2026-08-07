import { useState } from "react";
import { EmitirDocumentoTab } from "./EmitirDocumentoTab";
import { DocumentosEmitidosTab } from "./DocumentosEmitidosTab";
import { FiscalSettingsTab } from "./FiscalSettingsTab";

type TabKey = "emitir" | "documentos" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "emitir", label: "Emitir Documento" },
  { key: "documentos", label: "Documentos Emitidos" },
  { key: "settings", label: "Configurações" },
];

export function FiscalPage() {
  const [tab, setTab] = useState<TabKey>("emitir");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Fiscal</h1>

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

      {tab === "emitir" && <EmitirDocumentoTab />}
      {tab === "documentos" && <DocumentosEmitidosTab />}
      {tab === "settings" && <FiscalSettingsTab />}
    </div>
  );
}
