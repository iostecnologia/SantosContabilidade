import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calculator, Lock, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CreateTerminationInput, Employee, Termination, TerminationType } from "../../types/departamento-pessoal";
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS } from "./PayrollRunsTab";

function formatCurrency(value: string | number | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TYPE_LABELS: Record<TerminationType, string> = {
  WITHOUT_CAUSE: "Sem justa causa",
  RESIGNATION: "Pedido de demissão",
  WITH_CAUSE: "Justa causa",
  MUTUAL_AGREEMENT: "Acordo mútuo",
};

const createSchema = z.object({
  employeeId: z.string().min(1, "Obrigatório"),
  terminationDate: z.string().min(1, "Obrigatório"),
  type: z.enum(["WITHOUT_CAUSE", "RESIGNATION", "WITH_CAUSE", "MUTUAL_AGREEMENT"]),
  vestedVacationAmount: z.coerce.number().min(0).optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export function TerminationsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: terminations = [] } = useQuery({
    queryKey: ["terminations"],
    queryFn: () => apiGet<Termination[]>("/terminations"),
  });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => apiGet<Employee[]>("/employees") });

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["terminations"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: CreateTerminationInput) => apiPost<Termination>("/terminations", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar rescisão."),
  });

  const calculateMutation = useMutation({
    mutationFn: (id: string) => apiPost<Termination>(`/terminations/${id}/calculate`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao calcular."),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiPost<Termination>(`/terminations/${id}/post`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao postar."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/terminations/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover."),
  });

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const sorted = [...terminations].sort((a, b) => b.terminationDate.localeCompare(a.terminationDate));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Rescisões</h2>
        {hasPermission("terminations:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Registrar rescisão
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">{t.employee.fullName}</td>
                <td className="px-4 py-2 text-slate-400">{t.terminationDate.slice(0, 10)}</td>
                <td className="px-4 py-2 text-slate-400">{TYPE_LABELS[t.type]}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(t.netPay)}</td>
                <td className={`px-4 py-2 ${EVENT_STATUS_COLORS[t.status]}`}>{EVENT_STATUS_LABELS[t.status]}</td>
                <td className="px-4 py-2 text-right">
                  {t.status !== "POSTED" && hasPermission("terminations:create") && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => calculateMutation.mutate(t.id)} className="text-slate-400 hover:text-amber-400" title="Calcular">
                        <Calculator size={16} />
                      </button>
                      {t.status === "CALCULATED" && hasPermission("terminations:post") && (
                        <button onClick={() => postMutation.mutate(t.id)} className="text-slate-400 hover:text-emerald-400" title="Postar">
                          <Lock size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => window.confirm("Remover esta rescisão?") && removeMutation.mutate(t.id)}
                        className="text-slate-400 hover:text-red-400"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma rescisão registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Registrar rescisão" onClose={() => setCreating(false)}>
          <CreateForm
            employees={activeEmployees}
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
  employees,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  employees: Employee[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="Funcionário" {...register("employeeId")} error={errors.employeeId?.message}>
        <option value="">selecione</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.fullName}
          </option>
        ))}
      </Select>
      <Input label="Data do desligamento" type="date" {...register("terminationDate")} error={errors.terminationDate?.message} />
      <Select label="Tipo de desligamento" {...register("type")} error={errors.type?.message}>
        <option value="WITHOUT_CAUSE">Sem justa causa</option>
        <option value="RESIGNATION">Pedido de demissão</option>
        <option value="WITH_CAUSE">Justa causa</option>
        <option value="MUTUAL_AGREEMENT">Acordo mútuo</option>
      </Select>
      <Input
        label="Férias vencidas não gozadas (opcional, valor em R$)"
        type="number"
        step="0.01"
        {...register("vestedVacationAmount")}
        error={errors.vestedVacationAmount?.message}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
