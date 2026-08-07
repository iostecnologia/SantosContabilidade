import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Lock, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { PayrollRun } from "../../types/departamento-pessoal";
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS } from "./PayrollRunsTab";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: string | number | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PayrollRunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: run } = useQuery({
    queryKey: ["payroll-runs", runId],
    queryFn: () => apiGet<PayrollRun>(`/payroll-runs/${runId}`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll-runs", runId] });
    queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const calculateMutation = useMutation({
    mutationFn: () => apiPost<PayrollRun>(`/payroll-runs/${runId}/calculate`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao calcular folha."),
  });

  const postMutation = useMutation({
    mutationFn: () => apiPost<PayrollRun>(`/payroll-runs/${runId}/post`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao postar folha."),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiDelete(`/payroll-runs/${runId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      onBack();
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover folha."),
  });

  if (!run) {
    return null;
  }

  const lines = run.lines ?? [];
  const totalNetPay = lines.reduce((sum, l) => sum + Number(l.netPay), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Folha {MONTH_LABELS[run.competenceMonth - 1]}/{run.competenceYear}
          </h1>
          <p className={`text-sm ${EVENT_STATUS_COLORS[run.status]}`}>{EVENT_STATUS_LABELS[run.status]}</p>
        </div>
        <div className="flex gap-2">
          {run.status !== "POSTED" && hasPermission("payroll_runs:create") && (
            <>
              <Button variant="secondary" onClick={() => window.confirm("Remover esta folha?") && removeMutation.mutate()}>
                <Trash2 size={16} /> Remover
              </Button>
              <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending}>
                <Calculator size={16} /> Calcular
              </Button>
            </>
          )}
          {run.status === "CALCULATED" && hasPermission("payroll_runs:post") && (
            <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              <Lock size={16} /> Postar
            </Button>
          )}
        </div>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Funcionários nesta folha</h2>
          <span className="text-sm text-slate-400">Total líquido: {formatCurrency(totalNetPay)}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3 text-right">Salário base</th>
              <th className="px-4 py-3 text-right">INSS</th>
              <th className="px-4 py-3 text-right">IRRF</th>
              <th className="px-4 py-3 text-right">VT</th>
              <th className="px-4 py-3 text-right">VR/VA</th>
              <th className="px-4 py-3 text-right">Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2">{line.employee.fullName}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(line.baseSalary)}</td>
                <td className="px-4 py-2 text-right text-slate-400">{formatCurrency(line.inssAmount)}</td>
                <td className="px-4 py-2 text-right text-slate-400">{formatCurrency(line.irrfAmount)}</td>
                <td className="px-4 py-2 text-right text-slate-400">{formatCurrency(line.transportVoucherDiscount)}</td>
                <td className="px-4 py-2 text-right text-slate-400">
                  {formatCurrency(Number(line.mealVoucherBenefit) - Number(line.mealVoucherDiscount))}
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(line.netPay)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Ainda não calculada — clique em "Calcular".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
