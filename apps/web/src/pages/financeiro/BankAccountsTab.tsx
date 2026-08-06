import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account } from "../../types/accounting";
import type { BankAccount } from "../../types/financeiro";

const KIND_LABELS: Record<BankAccount["kind"], string> = { BANK: "Banco", CASH: "Caixa" };

const createSchema = z.object({
  kind: z.enum(["BANK", "CASH"]),
  name: z.string().min(1, "Obrigatório").max(160),
  bankCode: z.string().optional(),
  agency: z.string().optional(),
  accountNumber: z.string().optional(),
  glAccountId: z.string().min(1, "Obrigatório"),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Obrigatório").max(160),
  bankCode: z.string().optional(),
  agency: z.string().optional(),
  accountNumber: z.string().optional(),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

export function BankAccountsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => apiGet<BankAccount[]>("/bank-accounts"),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const accountLabel = new Map(accounts.map((a) => [a.id, `${a.code} — ${a.name}`]));

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<BankAccount>("/bank-accounts", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar."),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) => apiPatch<BankAccount>(`/bank-accounts/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contas Bancárias / Caixa</h2>
        {hasPermission("bank_accounts:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Nova
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Conta contábil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {bankAccounts.map((ba) => (
              <tr key={ba.id}>
                <td className="px-4 py-2">{ba.name}</td>
                <td className="px-4 py-2 text-slate-500">{KIND_LABELS[ba.kind]}</td>
                <td className="px-4 py-2 text-slate-500">{accountLabel.get(ba.glAccountId) ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={ba.isActive ? "text-emerald-400" : "text-slate-500"}>
                    {ba.isActive ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("bank_accounts:update") && (
                    <button
                      onClick={() => {
                        setFormError(null);
                        setEditing(ba);
                      }}
                      className="text-slate-400 hover:text-slate-100"
                      aria-label="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {bankAccounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma conta cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Nova conta bancária/caixa" onClose={() => setCreating(false)}>
          <CreateForm
            accounts={analyticAccounts}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar "${editing.name}"`} onClose={() => setEditing(null)}>
          <EditForm
            bankAccount={editing}
            error={formError}
            isSubmitting={editMutation.isPending}
            onClose={() => setEditing(null)}
            onSubmit={(values) => editMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
  accounts,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { kind: "BANK" } });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({ ...values, bankCode: values.bankCode || undefined, agency: values.agency || undefined, accountNumber: values.accountNumber || undefined }),
      )}
      className="flex flex-col gap-4"
    >
      <Select label="Tipo" {...register("kind")}>
        <option value="BANK">Banco</option>
        <option value="CASH">Caixa</option>
      </Select>
      <Input label="Nome" {...register("name")} error={errors.name?.message} />
      <Input label="Código do banco (opcional)" {...register("bankCode")} />
      <Input label="Agência (opcional)" {...register("agency")} />
      <Input label="Conta (opcional)" {...register("accountNumber")} />
      <Select label="Conta contábil" {...register("glAccountId")} error={errors.glAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
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

function EditForm({
  bankAccount,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  bankAccount: BankAccount;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: EditValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: bankAccount.name,
      bankCode: bankAccount.bankCode ?? "",
      agency: bankAccount.agency ?? "",
      accountNumber: bankAccount.accountNumber ?? "",
      isActive: bankAccount.isActive,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Nome" {...register("name")} error={errors.name?.message} />
      <Input label="Código do banco" {...register("bankCode")} />
      <Input label="Agência" {...register("agency")} />
      <Input label="Conta" {...register("accountNumber")} />
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
        Ativa
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
