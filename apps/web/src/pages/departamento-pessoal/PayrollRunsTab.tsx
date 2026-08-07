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
import type { CreatePayrollRunInput, PayrollEventStatus, PayrollRun } from "../../types/departamento-pessoal";
import { PayrollRunDetail } from "./PayrollRunDetail";

export const EVENT_STATUS_LABELS: Record<PayrollEventStatus, string> = {
  DRAFT: "Rascunho",
  CALCULATED: "Calculado",
  POSTED: "Postado",
};
export const EVENT_STATUS_COLORS: Record<PayrollEventStatus, string> = {
  DRAFT: "text-slate-400",
  CALCULATED: "text-amber-400",
  POSTED: "text-emerald-400",
};

const createSchema = z.object({
  competenceYear: z.coerce.number().int().min(2000).max(2100),
  competenceMonth: z.coerce.number().int().min(1).max(12),
});
type CreateValues = z.infer<typeof createSchema>;

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PayrollRunsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: runs = [] } = useQuery({ queryKey: ["payroll-runs"], queryFn: () => apiGet<PayrollRun[]>("/payroll-runs") });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: CreatePayrollRunInput) => apiPost<PayrollRun>("/payroll-runs", values),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      setCreating(false);
      setSelectedId(run.id);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar folha."),
  });

  if (selectedId) {
    return <PayrollRunDetail runId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const sorted = [...runs].sort((a, b) => b.competenceYear - a.competenceYear || b.competenceMonth - a.competenceMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Folhas de pagamento</h2>
        {hasPermission("payroll_runs:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Nova folha
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((run) => (
              <tr key={run.id} onClick={() => setSelectedId(run.id)} className="cursor-pointer hover:bg-slate-800/40">
                <td className="px-4 py-2 text-slate-400">{run.runNumber}</td>
                <td className="px-4 py-2">
                  {MONTH_LABELS[run.competenceMonth - 1]}/{run.competenceYear}
                </td>
                <td className={`px-4 py-2 ${EVENT_STATUS_COLORS[run.status]}`}>{EVENT_STATUS_LABELS[run.status]}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma folha criada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Nova folha de pagamento" onClose={() => setCreating(false)}>
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
  const now = new Date();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { competenceYear: now.getFullYear(), competenceMonth: now.getMonth() + 1 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Ano" type="number" {...register("competenceYear")} error={errors.competenceYear?.message} />
        <Input label="Mês" type="number" min={1} max={12} {...register("competenceMonth")} error={errors.competenceMonth?.message} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Criar"}
        </Button>
      </div>
    </form>
  );
}
