import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { apiGet, apiPostForm, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { BankAccount } from "../../types/financeiro";
import type { BankReconciliation, BankReconciliationStatus } from "../../types/bank-reconciliation";
import { BankReconciliationDetail } from "./BankReconciliationDetail";

export const STATUS_LABELS: Record<BankReconciliationStatus, string> = { OPEN: "Aberta", CLOSED: "Fechada" };
export const STATUS_COLORS: Record<BankReconciliationStatus, string> = {
  OPEN: "text-amber-400",
  CLOSED: "text-emerald-400",
};

export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BankReconciliationPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: reconciliations = [] } = useQuery({
    queryKey: ["bank-reconciliations"],
    queryFn: () => apiGet<BankReconciliation[]>("/bank-reconciliations"),
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => apiGet<BankAccount[]>("/bank-accounts"),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (form: FormData) => apiPostForm<BankReconciliation>("/bank-reconciliations/import", form),
    onSuccess: (rec) => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      setImporting(false);
      setSelectedId(rec.id);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao importar extrato."),
  });

  if (selectedId) {
    return <BankReconciliationDetail reconciliationId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const bankAccountLabel = new Map(bankAccounts.map((b) => [b.id, b.name]));
  const sorted = [...reconciliations].sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conciliação Bancária</h1>
        {hasPermission("bank_reconciliation:import") && (
          <Button
            onClick={() => {
              setFormError(null);
              setImporting(true);
            }}
          >
            <Upload size={16} /> Importar extrato (OFX)
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3 text-right">Saldo do extrato</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((rec) => (
              <tr key={rec.id} onClick={() => setSelectedId(rec.id)} className="cursor-pointer hover:bg-slate-800/40">
                <td className="px-4 py-2">{bankAccountLabel.get(rec.bankAccountId) ?? rec.bankAccount?.name}</td>
                <td className="px-4 py-2 text-slate-400">
                  {rec.periodStart.slice(0, 10)} — {rec.periodEnd.slice(0, 10)}
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(rec.statementClosingBalance)}</td>
                <td className={`px-4 py-2 ${STATUS_COLORS[rec.status]}`}>{STATUS_LABELS[rec.status]}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma conciliação importada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {importing && (
        <Modal title="Importar extrato bancário (OFX)" onClose={() => setImporting(false)}>
          <ImportForm
            bankAccounts={bankAccounts.filter((b) => b.isActive)}
            error={formError}
            isSubmitting={importMutation.isPending}
            onClose={() => setImporting(false)}
            onSubmit={(form) => importMutation.mutate(form)}
          />
        </Modal>
      )}
    </div>
  );
}

function ImportForm({
  bankAccounts,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  bankAccounts: BankAccount[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!bankAccountId) {
      setLocalError("Selecione a conta bancária/caixa.");
      return;
    }
    if (!file) {
      setLocalError("Selecione o arquivo OFX.");
      return;
    }
    setLocalError(null);
    const form = new FormData();
    form.append("bankAccountId", bankAccountId);
    form.append("file", file);
    onSubmit(form);
  };

  return (
    <div className="flex flex-col gap-4">
      <Select label="Conta bancária/caixa" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
        <option value="">selecione</option>
        {bankAccounts.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Arquivo OFX</span>
        <input
          type="file"
          accept=".ofx,.qfx,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200"
        />
      </label>
      {(localError || error) && <p className="text-sm text-red-400">{localError ?? error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Importando..." : "Importar"}
        </Button>
      </div>
    </div>
  );
}
