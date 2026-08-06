import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Undo2, Trash2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter, JournalEntry } from "../../types/accounting";

const lineSchema = z.object({
  accountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().optional(),
  direction: z.enum(["DEBIT", "CREDIT"]),
  amount: z.coerce.number().positive("Deve ser positivo"),
});

const createSchema = z.object({
  entryDate: z.string().min(1, "Obrigatório"),
  competenceDate: z.string().min(1, "Obrigatório"),
  description: z.string().min(1, "Obrigatório").max(500),
  lines: z.array(lineSchema).min(2, "Precisa de ao menos 2 linhas"),
});
type CreateValues = z.infer<typeof createSchema>;

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function entryTotal(entry: JournalEntry, direction: "DEBIT" | "CREDIT"): number {
  return entry.lines.filter((l) => l.direction === direction).reduce((s, l) => s + Number(l.amount), 0);
}

export function JournalEntriesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: entries = [] } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => apiGet<JournalEntry[]>("/journal-entries"),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => apiGet<CostCenter[]>("/cost-centers"),
  });

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["journal-entries"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      apiPost<JournalEntry>("/journal-entries", {
        ...values,
        lines: values.lines.map((l) => ({ ...l, costCenterId: l.costCenterId || undefined })),
      }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar lançamento."),
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => apiPost<JournalEntry>(`/journal-entries/${id}/reverse`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao estornar."),
  });

  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lançamentos Contábeis</h1>
        {hasPermission("journal_entries:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo lançamento
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3 text-right">Débito</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2 text-slate-300">{entry.entryNumber}</td>
                <td className="px-4 py-2 text-slate-500">{entry.entryDate.slice(0, 10)}</td>
                <td className="px-4 py-2">{entry.description}</td>
                <td className="px-4 py-2 text-slate-500">{entry.referenceModule}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(entryTotal(entry, "DEBIT"))}</td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("journal_entries:reverse") && !entry.reversalOfId && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Estornar o lançamento nº ${entry.entryNumber}?`)) {
                          reverseMutation.mutate(entry.id);
                        }
                      }}
                      className="text-slate-400 hover:text-amber-400"
                      aria-label="Estornar"
                      title="Estornar"
                    >
                      <Undo2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum lançamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <CreateEntryModal
          accounts={analyticAccounts}
          costCenters={costCenters}
          error={formError}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}
    </div>
  );
}

function CreateEntryModal({
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
  onSubmit: (values: CreateValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      entryDate: today,
      competenceDate: today,
      lines: [
        { accountId: "", direction: "DEBIT", amount: 0 },
        { accountId: "", direction: "CREDIT", amount: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines");
  const debitTotal = lines?.filter((l) => l.direction === "DEBIT").reduce((s, l) => s + (Number(l.amount) || 0), 0) ?? 0;
  const creditTotal = lines?.filter((l) => l.direction === "CREDIT").reduce((s, l) => s + (Number(l.amount) || 0), 0) ?? 0;
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01;

  return (
    <Modal title="Novo lançamento contábil" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data" type="date" {...register("entryDate")} error={errors.entryDate?.message} />
          <Input label="Competência" type="date" {...register("competenceDate")} error={errors.competenceDate?.message} />
        </div>
        <Input label="Descrição" {...register("description")} error={errors.description?.message} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Linhas</span>
            <button
              type="button"
              onClick={() => append({ accountId: "", direction: "DEBIT", amount: 0 })}
              className="text-xs text-emerald-400 hover:underline"
            >
              + adicionar linha
            </button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_100px_120px_auto] items-end gap-2">
              <Select label="Conta" {...register(`lines.${index}.accountId` as const)}>
                <option value="">selecione</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
              <Select label="Centro de custo" {...register(`lines.${index}.costCenterId` as const)}>
                <option value="">—</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code}
                  </option>
                ))}
              </Select>
              <Select label="Direção" {...register(`lines.${index}.direction` as const)}>
                <option value="DEBIT">Débito</option>
                <option value="CREDIT">Crédito</option>
              </Select>
              <Input label="Valor" type="number" step="0.01" {...register(`lines.${index}.amount` as const)} />
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length <= 2}
                className="mb-2 text-slate-500 hover:text-red-400 disabled:opacity-30"
                aria-label="Remover linha"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {errors.lines && <p className="text-xs text-red-400">{errors.lines.message}</p>}
        </div>

        <div className={`text-sm ${balanced ? "text-emerald-400" : "text-amber-400"}`}>
          Débito {formatCurrency(debitTotal)} · Crédito {formatCurrency(creditTotal)}
          {!balanced && " — desbalanceado"}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !balanced}>
            {isSubmitting ? "Salvando..." : "Lançar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
