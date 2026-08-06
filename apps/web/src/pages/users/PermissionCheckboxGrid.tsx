import type { Permission } from "../../types/access-control";
import { actionLabel, moduleLabel } from "../../types/access-control";

// Agrupa o catálogo por módulo e mostra a checkbox de "marcar tudo" do
// módulo ao lado do nome — cada ação exibida é a ação real do catálogo
// (ex.: "pagar"/"cancelar" em Contas a Pagar), não um genérico
// ler/editar/excluir que não existiria de verdade em todo módulo.
export function PermissionCheckboxGrid({
  catalog,
  selected,
  onChange,
  disabled = false,
}: {
  catalog: Permission[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const byModule = new Map<string, Permission[]>();
  for (const permission of catalog) {
    if (!byModule.has(permission.module)) {
      byModule.set(permission.module, []);
    }
    byModule.get(permission.module)!.push(permission);
  }

  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  const toggleModule = (perms: Permission[], checkAll: boolean) => {
    const next = new Set(selected);
    for (const p of perms) {
      if (checkAll) {
        next.add(p.key);
      } else {
        next.delete(p.key);
      }
    }
    onChange(next);
  };

  return (
    <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border border-slate-800 p-3">
      {[...byModule.entries()].map(([module, perms]) => {
        const allChecked = perms.every((p) => selected.has(p.key));
        return (
          <div key={module} className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={allChecked}
                disabled={disabled}
                onChange={(e) => toggleModule(perms, e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              {moduleLabel(module)}
            </label>
            <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
              {perms.map((p) => (
                <label key={p.key} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={selected.has(p.key)}
                    disabled={disabled}
                    onChange={() => toggleOne(p.key)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900"
                  />
                  {actionLabel(p.action)}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {catalog.length === 0 && <p className="text-sm text-slate-500">Nenhuma permissão no catálogo.</p>}
    </div>
  );
}
