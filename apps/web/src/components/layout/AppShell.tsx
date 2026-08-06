import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Landmark, FolderTree, BookOpenText, Wallet, PiggyBank, Boxes, FileBarChart, FileCheck2, Users, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/auth-context";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Plano de Contas", icon: Landmark },
  { to: "/cost-centers", label: "Centros de Custo", icon: FolderTree },
  { to: "/journal-entries", label: "Lançamentos", icon: BookOpenText },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/bank-reconciliation", label: "Conciliação Bancária", icon: FileCheck2 },
  { to: "/budget", label: "Orçamento", icon: PiggyBank },
  { to: "/warehouse", label: "Almoxarifado", icon: Boxes },
  { to: "/reports", label: "Relatórios", icon: FileBarChart },
  { to: "/users", label: "Usuários", icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { organization, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-slate-100">Santos SAF</p>
          <p className="truncate text-xs text-slate-500">{organization?.name}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-emerald-600/20 text-emerald-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => void logout()}
          className="mx-2 mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <LogOut size={16} />
          Sair
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
