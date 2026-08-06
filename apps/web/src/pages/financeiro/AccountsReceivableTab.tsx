import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Banknote, Ban } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter } from "../../types/accounting";
import type { AccountsReceivable, BankAccount, Counterparty, RegisterReceiptInput, TitleStatus } from "../../types/financeiro";

const STATUS_LABELS: Record<TitleStatus, string> = {
  OPEN: "Em aberto",
  PARTIALLY_PAID: "Parcial",
  PAID: "Recebido",
  CANCELED: "Cancelado",
};
const STATUS_COLORS: Record<TitleStatus, string> = {
  OPEN: "text-slate-400",
  PARTIALLY_PAID: "text-amber-400",
  PAID: "text-emerald-400",
  CANCELED: "text-red-400",
};

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const createSchema = z.object({
  counterpartyId: z.string().min(1, "Obrigatório"),
  description: z.string().min(1, "Obrigatório").max(500),
  issueDate: z.string().min(1, "Obrigatório"),
  dueDate: z.string().min(1, "Obrigatório"),
  competenceDate: z.string().min(1, "Obrigatório"),
  originalAmount: z.coerce.number().positive("Deve ser positivo"),
  assetAccountId: z.string().min(1, "Obrigatório"),
  revenueAccountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const receiptSchema = z.object({
  receiptDate: z.string().min(1, "Obrigatório"),
  amount: z.coerce.number().positive("Deve ser positivo"),
  bankAccountId: z.string().min(1, "Obrigatório"),
});
type ReceiptValues = z.infer<typeof receiptSchema>;

export function AccountsReceivableTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: bills = [] } = useQuery({ queryKey: ["accounts-receivable"], queryFn: () => apiGet<AccountsReceivable[]>("/accounts-receivable") });
  const { data: counterparties = [] } = useQuery({ queryKey: ["counterparties"], queryFn: () => apiGet<Counterparty[]>("/counterparties") });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["bank-accounts"], queryFn: () => apiGet<BankAccount[]>("/bank-accounts") });

  const customers = counterparties.filter((c) => c.type === "CUSTOMER" || c.type === "BOTH");
  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const counterpartyName = new Map(counterparties.map((c) => [c.id, c.name]));

  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<AccountsReceivable | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<AccountsReceivable>("/accounts-receivable", { ...values, costCenterId: values.costCenterId || undefined }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar título."),
  });

  const receiptMutation = useMutation({
    mutationFn: (values: RegisterReceiptInput) => apiPost<AccountsReceivable>(`/accounts-receivable/${receiving?.id}/receipts`, values),
    onSuccess: () => {
      invalidate();
      setReceiving(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar recebimento."),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiPost<AccountsReceivable>(`/accounts-receivable/${id}/cancel`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao cancelar."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contas a Receber</h2>
        {hasPermission("accounts_receivable:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo título
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Recebido</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="px-4 py-2 text-slate-300">{bill.documentNumber}</td>
                <td className="px-4 py-2">{counterpartyName.get(bill.counterpartyId) ?? "—"}</td>
                <td className="px-4 py-2 text-slate-400">{bill.description}</td>
                <td className="px-4 py-2 text-slate-500">{bill.dueDate.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(bill.originalAmount)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(bill.receivedAmount)}</td>
                <td className={`px-4 py-2 ${STATUS_COLORS[bill.status]}`}>{STATUS_LABELS[bill.status]}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {hasPermission("accounts_receivable:receive") && (bill.status === "OPEN" || bill.status === "PARTIALLY_PAID") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setReceiving(bill);
                        }}
                        className="text-slate-400 hover:text-emerald-400"
                        aria-label="Registrar recebimento"
                        title="Registrar recebimento"
                      >
                        <Banknote size={16} />
                      </button>
                    )}
                    {hasPermission("accounts_receivable:cancel") && Number(bill.receivedAmount) === 0 && bill.status !== "CANCELED" && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Cancelar o título nº ${bill.documentNumber}?`)) {
                            cancelMutation.mutate(bill.id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-400"
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Ban size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Nenhum título cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo título a receber" onClose={() => setCreating(false)}>
          <CreateForm
            counterparties={customers}
            accounts={analyticAccounts}
            costCenters={costCenters}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}

      {receiving && (
        <Modal title={`Registrar recebimento — título nº ${receiving.documentNumber}`} onClose={() => setReceiving(null)}>
          <ReceiptForm
            bankAccounts={bankAccounts}
            remaining={Number(receiving.originalAmount) - Number(receiving.receivedAmount)}
            error={formError}
            isSubmitting={receiptMutation.isPending}
            onClose={() => setReceiving(null)}
            onSubmit={(values) => receiptMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
  counterparties,
  accounts,
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  counterparties: Counterparty[];
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
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { issueDate: today, competenceDate: today, dueDate: today },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <Select label="Cliente" {...register("counterpartyId")} error={errors.counterpartyId?.message}>
        <option value="">selecione</option>
        {counterparties.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input label="Descrição" {...register("description")} error={errors.description?.message} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Emissão" type="date" {...register("issueDate")} />
        <Input label="Vencimento" type="date" {...register("dueDate")} />
        <Input label="Competência" type="date" {...register("competenceDate")} />
      </div>
      <Input label="Valor" type="number" step="0.01" {...register("originalAmount")} error={errors.originalAmount?.message} />
      <Select label="Conta de débito (clientes a receber)" {...register("assetAccountId")} error={errors.assetAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select label="Conta de crédito (receita)" {...register("revenueAccountId")} error={errors.revenueAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
        <option value="">—</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Lançar"}
        </Button>
      </div>
    </form>
  );
}

function ReceiptForm({
  bankAccounts,
  remaining,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  bankAccounts: BankAccount[];
  remaining: number;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ReceiptValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReceiptValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { receiptDate: today, amount: remaining },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Saldo em aberto: {formatCurrency(remaining)}</p>
      <Input label="Data do recebimento" type="date" {...register("receiptDate")} error={errors.receiptDate?.message} />
      <Input label="Valor" type="number" step="0.01" {...register("amount")} error={errors.amount?.message} />
      <Select label="Conta bancária/caixa" {...register("bankAccountId")} error={errors.bankAccountId?.message}>
        <option value="">selecione</option>
        {bankAccounts.map((ba) => (
          <option key={ba.id} value={ba.id}>
            {ba.name}
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Confirmar recebimento"}
        </Button>
      </div>
    </form>
  );
}
