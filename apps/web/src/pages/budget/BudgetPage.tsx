import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { BudgetPlan, BudgetStatus, CreateBudgetPlanInput } from "../../types/budget";
import { BudgetPlanDetail } from "./BudgetPlanDetail";

export const STATUS_LABELS: Record<BudgetStatus, string> = {
  DRAFT: "Rascunho",
  APPROVED: "Aprovado",
  CLOSED: "Encerrado",
};
export const STATUS_COLORS: Record<BudgetStatus, string> = {
  DRAFT: "text-slate-400",
  APPROVED: "text-emerald-400",
  CLOSED: "text-slate-500",
};

const createSchema = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  name: z.string().min(1, "Obrigatório").max(200),
});
type CreateValues = z.infer<typeof createSchema>;

export function BudgetPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["budget-plans"], queryFn: () => apiGet<BudgetPlan[]>("/budget-plans") });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: CreateBudgetPlanInput) => apiPost<BudgetPlan>("/budget-plans", values),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["budget-plans"] });
      setCreating(false);
      setSelectedId(plan.id);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar plano."),
  });

  if (selectedId) {
    return <BudgetPlanDetail planId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orçamento</h1>
        {hasPermission("budget:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo plano
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Ano</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Linhas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {plans.map((plan) => (
              <tr
                key={plan.id}
                onClick={() => setSelectedId(plan.id)}
                className="cursor-pointer hover:bg-slate-800/40"
              >
                <td className="px-4 py-2 text-slate-300">{plan.fiscalYear}</td>
                <td className="px-4 py-2">{plan.name}</td>
                <td className={`px-4 py-2 ${STATUS_COLORS[plan.status]}`}>{STATUS_LABELS[plan.status]}</td>
                <td className="px-4 py-2 text-right text-slate-400">{plan.lines.length}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhum plano orçamentário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo plano orçamentário" onClose={() => setCreating(false)}>
          <CreateForm
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { fiscalYear: new Date().getFullYear() },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Ano fiscal" type="number" {...register("fiscalYear")} error={errors.fiscalYear?.message} />
      <Input label="Nome" {...register("name")} error={errors.name?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </form>
  );
}
