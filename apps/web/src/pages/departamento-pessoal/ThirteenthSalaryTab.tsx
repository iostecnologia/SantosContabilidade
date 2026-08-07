import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CreateThirteenthSalaryRunInput, ThirteenthSalaryInstallment, ThirteenthSalaryRun } from "../../types/departamento-pessoal";
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS } from "./PayrollRunsTab";
import { ThirteenthSalaryDetail } from "./ThirteenthSalaryDetail";

const INSTALLMENT_LABELS: Record<ThirteenthSalaryInstallment, string> = {
  FIRST: "1ª parcela",
  SECOND: "2ª parcela",
  SINGLE: "Parcela única",
};

const createSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  installment: z.enum(["FIRST", "SECOND", "SINGLE"]),
});
type CreateValues = z.infer<typeof createSchema>;

export function ThirteenthSalaryTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: runs = [] } = useQuery({
    queryKey: ["thirteenth-salary-runs"],
    queryFn: () => apiGet<ThirteenthSalaryRun[]>("/thirteenth-salary-runs"),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: CreateThirteenthSalaryRunInput) => apiPost<ThirteenthSalaryRun>("/thirteenth-salary-runs", values),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["thirteenth-salary-runs"] });
      setCreating(false);
      setSelectedId(run.id);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar rodada."),
  });

  if (selectedId) {
    return <ThirteenthSalaryDetail runId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const sorted = [...runs].sort((a, b) => b.year - a.year || a.installment.localeCompare(b.installment));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">13º Salário</h2>
        {hasPermission("thirteenth_salary:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Nova rodada
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Ano</th>
              <th className="px-4 py-3">Parcela</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((run) => (
              <tr key={run.id} onClick={() => setSelectedId(run.id)} className="cursor-pointer hover:bg-slate-800/40">
                <td className="px-4 py-2 text-slate-400">{run.runNumber}</td>
                <td className="px-4 py-2">{run.year}</td>
                <td className="px-4 py-2 text-slate-400">{INSTALLMENT_LABELS[run.installment]}</td>
                <td className={`px-4 py-2 ${EVENT_STATUS_COLORS[run.status]}`}>{EVENT_STATUS_LABELS[run.status]}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma rodada de 13º criada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Nova rodada de 13º salário" onClose={() => setCreating(false)}>
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
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { year: new Date().getFullYear() } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Ano" type="number" {...register("year")} error={errors.year?.message} />
      <Select label="Parcela" {...register("installment")} error={errors.installment?.message}>
        <option value="FIRST">1ª parcela</option>
        <option value="SECOND">2ª parcela</option>
        <option value="SINGLE">Parcela única</option>
      </Select>
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
