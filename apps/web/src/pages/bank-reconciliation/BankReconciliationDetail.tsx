import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, Lock, Trash2, Undo2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter, JournalEntry, JournalEntryLine } from "../../types/accounting";
import type {
  BankReconciliation,
  BankReconciliationSummary,
  BankStatementLine,
  BankStatementLineStatus,
  CreateAdjustmentEntryInput,
} from "../../types/bank-reconciliation";
import { formatCurrency, STATUS_COLORS, STATUS_LABELS } from "./BankReconciliationPage";

type CandidateLine = JournalEntryLine & { journalEntry: JournalEntry };

const LINE_STATUS_LABELS: Record<BankStatementLineStatus, string> = {
  PENDING: "Pendente",
  MATCHED: "Conciliado",
  ADJUSTED: "Ajustado",
  IGNORED: "Ignorado",
};
const LINE_STATUS_COLORS: Record<BankStatementLineStatus, string> = {
  PENDING: "text-amber-400",
  MATCHED: "text-emerald-400",
  ADJUSTED: "text-sky-400",
  IGNORED: "text-slate-500",
};

const adjustmentSchema = z.object({
  contraAccountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().optional(),
  description: z.string().optional(),
});
type AdjustmentValues = z.infer<typeof adjustmentSchema>;

export function BankReconciliationDetail({
  reconciliationId,
  onBack,
}: {
  reconciliationId: string;
  onBack: () => void;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data: reconciliation } = useQuery({
    queryKey: ["bank-reconciliations", reconciliationId],
    queryFn: () => apiGet<BankReconciliation>(`/bank-reconciliations/${reconciliationId}`),
  });
  const { data: summary } = useQuery({
    queryKey: ["bank-reconciliations", reconciliationId, "summary"],
    queryFn: () => apiGet<BankReconciliationSummary>(`/bank-reconciliations/${reconciliationId}/summary`),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => apiGet<CostCenter[]>("/cost-centers"),
  });

  const [matchingLine, setMatchingLine] = useState<BankStatementLine | null>(null);
  const [adjustingLine, setAdjustingLine] = useState<BankStatementLine | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-reconciliations", reconciliationId] });
    queryClient.invalidateQueries({ queryKey: ["bank-reconciliations", reconciliationId, "summary"] });
    queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
  };

  const { data: candidates = [] } = useQuery({
    queryKey: ["bank-reconciliations", reconciliationId, "candidates", matchingLine?.id],
    queryFn: () =>
      apiGet<CandidateLine[]>(`/bank-reconciliations/${reconciliationId}/lines/${matchingLine?.id}/candidates`),
    enabled: !!matchingLine,
  });

  const matchMutation = useMutation({
    mutationFn: (journalEntryLineId: string) =>
      apiPost<BankReconciliation>(`/bank-reconciliations/${reconciliationId}/lines/${matchingLine?.id}/match`, {
        journalEntryLineId,
      }),
    onSuccess: () => {
      invalidate();
      setMatchingLine(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao conciliar."),
  });

  const ignoreMutation = useMutation({
    mutationFn: (lineId: string) =>
      apiPost<BankReconciliation>(`/bank-reconciliations/${reconciliationId}/lines/${lineId}/ignore`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao ignorar linha."),
  });

  const resetMutation = useMutation({
    mutationFn: (lineId: string) =>
      apiPost<BankReconciliation>(`/bank-reconciliations/${reconciliationId}/lines/${lineId}/reset`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao desfazer."),
  });

  const adjustMutation = useMutation({
    mutationFn: (values: CreateAdjustmentEntryInput) =>
      apiPost<BankReconciliation>(
        `/bank-reconciliations/${reconciliationId}/lines/${adjustingLine?.id}/create-entry`,
        values,
      ),
    onSuccess: () => {
      invalidate();
      setAdjustingLine(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar lançamento de ajuste."),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiPost<BankReconciliation>(`/bank-reconciliations/${reconciliationId}/close`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao fechar conciliação."),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiDelete(`/bank-reconciliations/${reconciliationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      onBack();
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover conciliação."),
  });

  if (!reconciliation) {
    return null;
  }

  const isOpen = reconciliation.status === "OPEN";
  const lines = [...(reconciliation.lines ?? [])].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const activeCostCenters = costCenters.filter((cc) => cc.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{reconciliation.bankAccount.name}</h1>
          <p className="text-sm text-slate-400">
            {reconciliation.periodStart.slice(0, 10)} — {reconciliation.periodEnd.slice(0, 10)} ·{" "}
            <span className={STATUS_COLORS[reconciliation.status]}>{STATUS_LABELS[reconciliation.status]}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {isOpen && hasPermission("bank_reconciliation:import") && (
            <Button
              variant="secondary"
              onClick={() => window.confirm("Remover esta conciliação e reimportar depois?") && removeMutation.mutate()}
            >
              <Trash2 size={16} /> Remover
            </Button>
          )}
          {isOpen && hasPermission("bank_reconciliation:close") && (
            <Button onClick={() => closeMutation.mutate()} disabled={!summary?.canClose || closeMutation.isPending}>
              <Lock size={16} /> Fechar
            </Button>
          )}
        </div>
      </div>

      {summary && (
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Saldo do extrato</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.statementClosingBalance)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Saldo no sistema</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.systemBalance)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Diferença</p>
              <p className={`text-lg font-semibold ${Math.abs(summary.difference) < 0.01 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(summary.difference)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Pendentes</p>
              <p className={`text-lg font-semibold ${summary.pendingCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {summary.pendingCount}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Linhas do extrato</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Lançamento</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 text-slate-500">{line.transactionDate.slice(0, 10)}</td>
                <td className="px-4 py-2">{line.description}</td>
                <td className={`px-4 py-2 text-right ${Number(line.amount) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatCurrency(line.amount)}
                </td>
                <td className={`px-4 py-2 ${LINE_STATUS_COLORS[line.status]}`}>{LINE_STATUS_LABELS[line.status]}</td>
                <td className="px-4 py-2 text-slate-400">
                  {line.matchedJournalEntryLine
                    ? `nº ${line.matchedJournalEntryLine.journalEntry.entryNumber} — ${line.matchedJournalEntryLine.journalEntry.description}`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {isOpen && hasPermission("bank_reconciliation:match") && (
                    <div className="flex justify-end gap-2">
                      {line.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => {
                              setFormError(null);
                              setMatchingLine(line);
                            }}
                            className="text-slate-400 hover:text-emerald-400"
                            title="Conciliar com lançamento existente"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setFormError(null);
                              setAdjustingLine(line);
                            }}
                            className="text-xs text-slate-400 hover:text-sky-400"
                            title="Criar lançamento de ajuste"
                          >
                            Ajustar
                          </button>
                          <button
                            onClick={() => ignoreMutation.mutate(line.id)}
                            className="text-slate-400 hover:text-red-400"
                            title="Ignorar"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      {(line.status === "MATCHED" || line.status === "IGNORED") && (
                        <button
                          onClick={() => resetMutation.mutate(line.id)}
                          className="text-slate-400 hover:text-slate-100"
                          title="Desfazer"
                        >
                          <Undo2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma linha neste extrato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {matchingLine && (
        <Modal title={`Conciliar — ${matchingLine.description}`} onClose={() => setMatchingLine(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              Valor do extrato: <span className="font-semibold">{formatCurrency(matchingLine.amount)}</span>
            </p>
            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-800">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => matchMutation.mutate(c.id)}
                  disabled={matchMutation.isPending}
                  className="flex w-full flex-col gap-0.5 border-b border-slate-800 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-800/60"
                >
                  <span>
                    nº {c.journalEntry.entryNumber} — {c.journalEntry.description}
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.journalEntry.entryDate.slice(0, 10)} · {formatCurrency(c.amount)}
                  </span>
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate-500">
                  Nenhum lançamento compatível encontrado nesta conta.
                </p>
              )}
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setMatchingLine(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {adjustingLine && (
        <Modal title={`Lançamento de ajuste — ${adjustingLine.description}`} onClose={() => setAdjustingLine(null)}>
          <AdjustmentForm
            accounts={analyticAccounts}
            costCenters={activeCostCenters}
            defaultDescription={`Ajuste de conciliação bancária — ${adjustingLine.description}`}
            error={formError}
            isSubmitting={adjustMutation.isPending}
            onClose={() => setAdjustingLine(null)}
            onSubmit={(values) => adjustMutation.mutate({ ...values, costCenterId: values.costCenterId || undefined })}
          />
        </Modal>
      )}
    </div>
  );
}

function AdjustmentForm({
  accounts,
  costCenters,
  defaultDescription,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  costCenters: CostCenter[];
  defaultDescription: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AdjustmentValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { description: defaultDescription },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="Contrapartida" {...register("contraAccountId")} error={errors.contraAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
        <option value="">nenhum</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      <Input label="Descrição" {...register("description")} error={errors.description?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Criar lançamento"}
        </Button>
      </div>
    </form>
  );
}
