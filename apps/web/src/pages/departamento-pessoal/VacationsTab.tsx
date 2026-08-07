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
import type { CreateVacationInput, Employee, Vacation } from "../../types/departamento-pessoal";
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS } from "./PayrollRunsTab";

function formatCurrency(value: string | number | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const createSchema = z.object({
  employeeId: z.string().min(1, "Obrigatório"),
  acquisitionPeriodStart: z.string().min(1, "Obrigatório"),
  acquisitionPeriodEnd: z.string().min(1, "Obrigatório"),
  startDate: z.string().min(1, "Obrigatório"),
  daysTaken: z.coerce.number().int().min(1).max(30),
  daysSold: z.coerce.number().int().min(0).max(10),
});
type CreateValues = z.infer<typeof createSchema>;

export function VacationsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: vacations = [] } = useQuery({ queryKey: ["vacations"], queryFn: () => apiGet<Vacation[]>("/vacations") });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => apiGet<Employee[]>("/employees") });

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vacations"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateVacationInput) => apiPost<Vacation>("/vacations", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar férias."),
  });

  const calculateMutation = useMutation({
    mutationFn: (id: string) => apiPost<Vacation>(`/vacations/${id}/calculate`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao calcular."),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiPost<Vacation>(`/vacations/${id}/post`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao postar."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/vacations/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover."),
  });

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const sorted = [...vacations].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Férias</h2>
        {hasPermission("vacations:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Registrar férias
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3 text-right">Dias</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2">{v.employee.fullName}</td>
                <td className="px-4 py-2 text-slate-400">{v.startDate.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">
                  {v.daysTaken}
                  {v.daysSold > 0 ? ` + ${v.daysSold} vendido(s)` : ""}
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(v.netPay)}</td>
                <td className={`px-4 py-2 ${EVENT_STATUS_COLORS[v.status]}`}>{EVENT_STATUS_LABELS[v.status]}</td>
                <td className="px-4 py-2 text-right">
                  {v.status !== "POSTED" && hasPermission("vacations:create") && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => calculateMutation.mutate(v.id)} className="text-slate-400 hover:text-amber-400" title="Calcular">
                        <Calculator size={16} />
                      </button>
                      {v.status === "CALCULATED" && hasPermission("vacations:post") && (
                        <button onClick={() => postMutation.mutate(v.id)} className="text-slate-400 hover:text-emerald-400" title="Postar">
                          <Lock size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => window.confirm("Remover este registro de férias?") && removeMutation.mutate(v.id)}
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
                  Nenhum registro de férias ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Registrar férias" onClose={() => setCreating(false)}>
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
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { daysTaken: 30, daysSold: 0 } });

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
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Período aquisitivo — início"
          type="date"
          {...register("acquisitionPeriodStart")}
          error={errors.acquisitionPeriodStart?.message}
        />
        <Input
          label="Período aquisitivo — fim"
          type="date"
          {...register("acquisitionPeriodEnd")}
          error={errors.acquisitionPeriodEnd?.message}
        />
      </div>
      <Input label="Início do gozo" type="date" {...register("startDate")} error={errors.startDate?.message} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Dias gozados" type="number" {...register("daysTaken")} error={errors.daysTaken?.message} />
        <Input label="Dias vendidos (abono)" type="number" {...register("daysSold")} error={errors.daysSold?.message} />
      </div>
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
