import { useState } from "react";
import { InventoryItemsTab } from "./InventoryItemsTab";
import { WarehousesTab } from "./WarehousesTab";

type TabKey = "items" | "warehouses";

const TABS: { key: TabKey; label: string }[] = [
  { key: "items", label: "Itens" },
  { key: "warehouses", label: "Depósitos" },
];

export function WarehousePage() {
  const [tab, setTab] = useState<TabKey>("items");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Almoxarifado</h1>

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

      {tab === "items" && <InventoryItemsTab />}
      {tab === "warehouses" && <WarehousesTab />}
    </div>
  );
}
