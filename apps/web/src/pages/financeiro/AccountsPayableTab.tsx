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
import type { AccountsPayable, BankAccount, Counterparty, RegisterPaymentInput, TitleStatus } from "../../types/financeiro";

const STATUS_LABELS: Record<TitleStatus, string> = {
  OPEN: "Em aberto",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pago",
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
  expenseAccountId: z.string().min(1, "Obrigatório"),
  liabilityAccountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const paymentSchema = z.object({
  paymentDate: z.string().min(1, "Obrigatório"),
  amount: z.coerce.number().positive("Deve ser positivo"),
  bankAccountId: z.string().min(1, "Obrigatório"),
});
type PaymentValues = z.infer<typeof paymentSchema>;

export function AccountsPayableTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: bills = [] } = useQuery({ queryKey: ["accounts-payable"], queryFn: () => apiGet<AccountsPayable[]>("/accounts-payable") });
  const { data: counterparties = [] } = useQuery({ queryKey: ["counterparties"], queryFn: () => apiGet<Counterparty[]>("/counterparties") });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["bank-accounts"], queryFn: () => apiGet<BankAccount[]>("/bank-accounts") });

  const suppliers = counterparties.filter((c) => c.type === "SUPPLIER" || c.type === "BOTH");
  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const counterpartyName = new Map(counterparties.map((c) => [c.id, c.name]));

  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<AccountsPayable | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<AccountsPayable>("/accounts-payable", { ...values, costCenterId: values.costCenterId || undefined }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar título."),
  });

  const paymentMutation = useMutation({
    mutationFn: (values: RegisterPaymentInput) => apiPost<AccountsPayable>(`/accounts-payable/${paying?.id}/payments`, values),
    onSuccess: () => {
      invalidate();
      setPaying(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar pagamento."),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiPost<AccountsPayable>(`/accounts-payable/${id}/cancel`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao cancelar."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contas a Pagar</h2>
        {hasPermission("accounts_payable:create") && (
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
              <th className="px-4 py-3">Fornecedor</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Pago</th>
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
                <td className="px-4 py-2 text-right">{formatCurrency(bill.paidAmount)}</td>
                <td className={`px-4 py-2 ${STATUS_COLORS[bill.status]}`}>{STATUS_LABELS[bill.status]}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {hasPermission("accounts_payable:pay") && (bill.status === "OPEN" || bill.status === "PARTIALLY_PAID") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setPaying(bill);
                        }}
                        className="text-slate-400 hover:text-emerald-400"
                        aria-label="Registrar pagamento"
                        title="Registrar pagamento"
                      >
                        <Banknote size={16} />
                      </button>
                    )}
                    {hasPermission("accounts_payable:cancel") && Number(bill.paidAmount) === 0 && bill.status !== "CANCELED" && (
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
        <Modal title="Novo título a pagar" onClose={() => setCreating(false)}>
          <CreateForm
            counterparties={suppliers}
            accounts={analyticAccounts}
            costCenters={costCenters}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}

      {paying && (
        <Modal title={`Registrar pagamento — título nº ${paying.documentNumber}`} onClose={() => setPaying(null)}>
          <PaymentForm
            bankAccounts={bankAccounts}
            remaining={Number(paying.originalAmount) - Number(paying.paidAmount)}
            error={formError}
            isSubmitting={paymentMutation.isPending}
            onClose={() => setPaying(null)}
            onSubmit={(values) => paymentMutation.mutate(values)}
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
      <Select label="Fornecedor" {...register("counterpartyId")} error={errors.counterpartyId?.message}>
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
      <Select label="Conta de débito (despesa/ativo)" {...register("expenseAccountId")} error={errors.expenseAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select label="Conta de crédito (fornecedores a pagar)" {...register("liabilityAccountId")} error={errors.liabilityAccountId?.message}>
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

function PaymentForm({
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
  onSubmit: (values: PaymentValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: today, amount: remaining },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Saldo em aberto: {formatCurrency(remaining)}</p>
      <Input label="Data do pagamento" type="date" {...register("paymentDate")} error={errors.paymentDate?.message} />
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
          {isSubmitting ? "Salvando..." : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}
