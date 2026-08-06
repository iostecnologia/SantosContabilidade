import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter } from "../../types/accounting";
import type {
  BudgetLine,
  BudgetPlan,
  BudgetVarianceReport,
  CreateBudgetLineInput,
} from "../../types/budget";
import { STATUS_COLORS, STATUS_LABELS } from "./BudgetPage";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const lineSchema = z.object({
  accountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().min(1, "Obrigatório"),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().positive("Deve ser positivo"),
});
type LineValues = z.infer<typeof lineSchema>;

const amountSchema = z.object({ amount: z.coerce.number().positive("Deve ser positivo") });
type AmountValues = z.infer<typeof amountSchema>;

export function BudgetPlanDetail({ planId, onBack }: { planId: string; onBack: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({ queryKey: ["budget-plans", planId], queryFn: () => apiGet<BudgetPlan>(`/budget-plans/${planId}`) });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });
  const { data: variance } = useQuery({
    queryKey: ["budget-plans", planId, "variance"],
    queryFn: () => apiGet<BudgetVarianceReport>(`/budget-plans/${planId}/variance`),
    enabled: !!plan,
  });

  const [addingLine, setAddingLine] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: ["budget-plans", planId] });
    queryClient.invalidateQueries({ queryKey: ["budget-plans"] });
    queryClient.invalidateQueries({ queryKey: ["budget-plans", planId, "variance"] });
  };

  const approveMutation = useMutation({
    mutationFn: () => apiPost<BudgetPlan>(`/budget-plans/${planId}/approve`),
    onSuccess: invalidatePlan,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao aprovar plano."),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiPost<BudgetPlan>(`/budget-plans/${planId}/close`),
    onSuccess: invalidatePlan,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao encerrar plano."),
  });

  const deletePlanMutation = useMutation({
    mutationFn: () => apiDelete(`/budget-plans/${planId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-plans"] });
      onBack();
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover plano."),
  });

  const addLineMutation = useMutation({
    mutationFn: (values: CreateBudgetLineInput) => apiPost<BudgetPlan>(`/budget-plans/${planId}/lines`, values),
    onSuccess: () => {
      invalidatePlan();
      setAddingLine(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao adicionar linha."),
  });

  const updateLineMutation = useMutation({
    mutationFn: (values: AmountValues) => apiPatch<BudgetPlan>(`/budget-plans/${planId}/lines/${editingLine?.id}`, values),
    onSuccess: () => {
      invalidatePlan();
      setEditingLine(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao atualizar linha."),
  });

  const removeLineMutation = useMutation({
    mutationFn: (lineId: string) => apiDelete(`/budget-plans/${planId}/lines/${lineId}`),
    onSuccess: invalidatePlan,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover linha."),
  });

  if (!plan) {
    return null;
  }

  const isDraft = plan.status === "DRAFT";
  const accountLabel = new Map(accounts.map((a) => [a.id, `${a.code} — ${a.name}`]));
  const costCenterLabel = new Map(costCenters.map((cc) => [cc.id, `${cc.code} — ${cc.name}`]));
  const sortedLines = [...plan.lines].sort((a, b) => a.month - b.month || a.accountId.localeCompare(b.accountId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {plan.name} <span className="text-slate-500">— {plan.fiscalYear}</span>
          </h1>
          <p className={`text-sm ${STATUS_COLORS[plan.status]}`}>{STATUS_LABELS[plan.status]}</p>
        </div>
        <div className="flex gap-2">
          {isDraft && hasPermission("budget:delete") && (
            <Button variant="secondary" onClick={() => window.confirm("Remover este plano orçamentário?") && deletePlanMutation.mutate()}>
              <Trash2 size={16} /> Remover
            </Button>
          )}
          {isDraft && hasPermission("budget:approve") && (
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <CheckCircle2 size={16} /> Aprovar
            </Button>
          )}
          {plan.status === "APPROVED" && hasPermission("budget:close") && (
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              <Lock size={16} /> Encerrar
            </Button>
          )}
        </div>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Linhas orçadas</h2>
          {isDraft && hasPermission("budget:update") && (
            <Button
              onClick={() => {
                setFormError(null);
                setAddingLine(true);
              }}
            >
              <Plus size={16} /> Adicionar linha
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Centro de custo</th>
              <th className="px-4 py-3 text-right">Valor orçado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedLines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 text-slate-300">{MONTH_LABELS[line.month - 1]}</td>
                <td className="px-4 py-2">{accountLabel.get(line.accountId) ?? line.accountId}</td>
                <td className="px-4 py-2 text-slate-400">{costCenterLabel.get(line.costCenterId) ?? line.costCenterId}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(line.amount)}</td>
                <td className="px-4 py-2 text-right">
                  {isDraft && hasPermission("budget:update") && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setFormError(null);
                          setEditingLine(line);
                        }}
                        className="text-slate-400 hover:text-emerald-400"
                        aria-label="Editar valor"
                        title="Editar valor"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Remover esta linha orçamentária?")) {
                            removeLineMutation.mutate(line.id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-400"
                        aria-label="Remover"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sortedLines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma linha orçada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Realizado x Orçado</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Centro de custo</th>
              <th className="px-4 py-3 text-right">Orçado</th>
              <th className="px-4 py-3 text-right">Realizado</th>
              <th className="px-4 py-3 text-right">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {variance?.rows.map((row) => (
              <tr key={`${row.accountId}-${row.costCenterId}-${row.month}`}>
                <td className="px-4 py-2 text-slate-300">{MONTH_LABELS[row.month - 1]}</td>
                <td className="px-4 py-2">{accountLabel.get(row.accountId) ?? row.accountId}</td>
                <td className="px-4 py-2 text-slate-400">{costCenterLabel.get(row.costCenterId) ?? row.costCenterId}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.budgeted)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.realized)}</td>
                <td className={`px-4 py-2 text-right ${row.variance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatCurrency(row.variance)}
                </td>
              </tr>
            ))}
            {(!variance || variance.rows.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sem linhas orçadas para comparar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {addingLine && (
        <Modal title="Adicionar linha orçamentária" onClose={() => setAddingLine(false)}>
          <LineForm
            accounts={accounts.filter((a) => a.isAnalytic && a.isActive)}
            costCenters={costCenters.filter((cc) => cc.isActive)}
            error={formError}
            isSubmitting={addLineMutation.isPending}
            onClose={() => setAddingLine(false)}
            onSubmit={(values) => addLineMutation.mutate(values)}
          />
        </Modal>
      )}

      {editingLine && (
        <Modal
          title={`Editar valor — ${MONTH_LABELS[editingLine.month - 1]} · ${accountLabel.get(editingLine.accountId) ?? ""}`}
          onClose={() => setEditingLine(null)}
        >
          <AmountForm
            defaultAmount={Number(editingLine.amount)}
            error={formError}
            isSubmitting={updateLineMutation.isPending}
            onClose={() => setEditingLine(null)}
            onSubmit={(values) => updateLineMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function LineForm({
  accounts,
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  costCenters: CostCenter[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: LineValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LineValues>({ resolver: zodResolver(lineSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="Conta" {...register("accountId")} error={errors.accountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select label="Centro de custo" {...register("costCenterId")} error={errors.costCenterId?.message}>
        <option value="">selecione</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      <Select label="Mês" {...register("month")} error={errors.month?.message}>
        {MONTH_LABELS.map((label, index) => (
          <option key={label} value={index + 1}>
            {label}
          </option>
        ))}
      </Select>
      <Input label="Valor orçado" type="number" step="0.01" {...register("amount")} error={errors.amount?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}

function AmountForm({
  defaultAmount,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  defaultAmount: number;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AmountValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AmountValues>({ resolver: zodResolver(amountSchema), defaultValues: { amount: defaultAmount } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Valor orçado" type="number" step="0.01" {...register("amount")} error={errors.amount?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
