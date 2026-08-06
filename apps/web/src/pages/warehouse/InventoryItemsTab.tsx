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
import type { Account } from "../../types/accounting";
import type { CreateInventoryItemInput, InventoryItem } from "../../types/warehouse";
import { InventoryItemDetail } from "./InventoryItemDetail";

function formatQuantity(value: string): string {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
function formatCurrency(value: string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const createSchema = z.object({
  code: z.string().min(1, "Obrigatório").max(30),
  name: z.string().min(1, "Obrigatório").max(200),
  unit: z.string().min(1, "Obrigatório").max(10),
  inventoryAccountId: z.string().min(1, "Obrigatório"),
});
type CreateValues = z.infer<typeof createSchema>;

export function InventoryItemsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["inventory-items"], queryFn: () => apiGet<InventoryItem[]>("/inventory-items") });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: CreateInventoryItemInput) => apiPost<InventoryItem>("/inventory-items", values),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setCreating(false);
      setSelectedId(item.id);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar item."),
  });

  if (selectedId) {
    return <InventoryItemDetail itemId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Itens de Estoque</h2>
        {hasPermission("inventory_items:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo item
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">UN</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Custo médio</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map((item) => (
              <tr key={item.id} onClick={() => setSelectedId(item.id)} className="cursor-pointer hover:bg-slate-800/40">
                <td className="px-4 py-2 text-slate-300">{item.code}</td>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                <td className="px-4 py-2 text-right">{formatQuantity(item.totalQuantity)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.averageCost)}</td>
                <td className="px-4 py-2">
                  <span className={item.isActive ? "text-emerald-400" : "text-slate-500"}>{item.isActive ? "Ativo" : "Inativo"}</span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum item cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo item de estoque" onClose={() => setCreating(false)}>
          <CreateForm
            accounts={accounts.filter((a) => a.isAnalytic && a.isActive)}
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
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Código" {...register("code")} error={errors.code?.message} />
      <Input label="Nome" {...register("name")} error={errors.name?.message} />
      <Input label="Unidade (ex.: UN, KG)" {...register("unit")} error={errors.unit?.message} />
      <Select label="Conta contábil de estoque" {...register("inventoryAccountId")} error={errors.inventoryAccountId?.message}>
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
