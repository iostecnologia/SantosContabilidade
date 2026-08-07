import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/auth-context";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CostCentersPage } from "./pages/cost-centers/CostCentersPage";
import { AccountsPage } from "./pages/accounts/AccountsPage";
import { JournalEntriesPage } from "./pages/journal-entries/JournalEntriesPage";
import { FinanceiroPage } from "./pages/financeiro/FinanceiroPage";
import { BankReconciliationPage } from "./pages/bank-reconciliation/BankReconciliationPage";
import { UsersPage } from "./pages/users/UsersPage";
import { DepartamentoPessoalPage } from "./pages/departamento-pessoal/DepartamentoPessoalPage";
import { BudgetPage } from "./pages/budget/BudgetPage";
import { WarehousePage } from "./pages/warehouse/WarehousePage";
import { ReportsPage } from "./pages/reports/ReportsPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cost-centers"
        element={
          <ProtectedRoute>
            <CostCentersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <AccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/journal-entries"
        element={
          <ProtectedRoute>
            <JournalEntriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute>
            <FinanceiroPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bank-reconciliation"
        element={
          <ProtectedRoute>
            <BankReconciliationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget"
        element={
          <ProtectedRoute>
            <BudgetPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warehouse"
        element={
          <ProtectedRoute>
            <WarehousePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/departamento-pessoal"
        element={
          <ProtectedRoute>
            <DepartamentoPessoalPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
