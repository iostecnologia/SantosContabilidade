import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownToLine, ArrowLeft, ArrowRightLeft, ArrowUpFromLine } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account } from "../../types/accounting";
import type {
  InventoryItem,
  RegisterInboundInput,
  RegisterOutboundInput,
  RegisterTransferInput,
  Warehouse,
} from "../../types/warehouse";

function formatQuantity(value: string): string {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
function formatCurrency(value: string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const inboundSchema = z.object({
  warehouseId: z.string().min(1, "Obrigatório"),
  quantity: z.coerce.number().positive("Deve ser positivo"),
  unitCost: z.coerce.number().positive("Deve ser positivo"),
  counterAccountId: z.string().min(1, "Obrigatório"),
  movementDate: z.string().min(1, "Obrigatório"),
});
type InboundValues = z.infer<typeof inboundSchema>;

const outboundSchema = z.object({
  warehouseId: z.string().min(1, "Obrigatório"),
  quantity: z.coerce.number().positive("Deve ser positivo"),
  counterAccountId: z.string().min(1, "Obrigatório"),
  movementDate: z.string().min(1, "Obrigatório"),
});
type OutboundValues = z.infer<typeof outboundSchema>;

const transferSchema = z.object({
  fromWarehouseId: z.string().min(1, "Obrigatório"),
  toWarehouseId: z.string().min(1, "Obrigatório"),
  quantity: z.coerce.number().positive("Deve ser positivo"),
  transferDate: z.string().min(1, "Obrigatório"),
});
type TransferValues = z.infer<typeof transferSchema>;

export function InventoryItemDetail({ itemId, onBack }: { itemId: string; onBack: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: item } = useQuery({ queryKey: ["inventory-items", itemId], queryFn: () => apiGet<InventoryItem>(`/inventory-items/${itemId}`) });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiGet<Warehouse[]>("/warehouses") });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });

  const [showInbound, setShowInbound] = useState(false);
  const [showOutbound, setShowOutbound] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-items", itemId] });
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
  };

  const inboundMutation = useMutation({
    mutationFn: (values: RegisterInboundInput) => apiPost<InventoryItem>(`/inventory-items/${itemId}/inbound`, values),
    onSuccess: () => {
      invalidate();
      setShowInbound(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar entrada."),
  });

  const outboundMutation = useMutation({
    mutationFn: (values: RegisterOutboundInput) => apiPost<InventoryItem>(`/inventory-items/${itemId}/outbound`, values),
    onSuccess: () => {
      invalidate();
      setShowOutbound(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao registrar saída."),
  });

  const transferMutation = useMutation({
    mutationFn: (values: RegisterTransferInput) => apiPost<InventoryItem>(`/inventory-items/${itemId}/transfers`, values),
    onSuccess: () => {
      invalidate();
      setShowTransfer(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao transferir."),
  });

  if (!item) {
    return null;
  }

  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const warehouseLabel = new Map(warehouses.map((w) => [w.id, `${w.code} — ${w.name}`]));
  const movements = [...(item.movements ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const transfers = [...(item.transfers ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {item.code} — {item.name}
          </h1>
          <p className="text-sm text-slate-400">
            Saldo: {formatQuantity(item.totalQuantity)} {item.unit} · Custo médio: {formatCurrency(item.averageCost)}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission("inventory_items:inbound") && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setShowInbound(true);
              }}
            >
              <ArrowDownToLine size={16} /> Entrada
            </Button>
          )}
          {hasPermission("inventory_items:outbound") && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setShowOutbound(true);
              }}
            >
              <ArrowUpFromLine size={16} /> Saída
            </Button>
          )}
          {hasPermission("inventory_items:transfer") && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setShowTransfer(true);
              }}
            >
              <ArrowRightLeft size={16} /> Transferir
            </Button>
          )}
        </div>
      </div>

      <Card className="p-0">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Saldo por depósito</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Depósito</th>
              <th className="px-4 py-3 text-right">Quantidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {item.stocks
              .filter((s) => Number(s.quantity) !== 0)
              .map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    {s.warehouse.code} — {s.warehouse.name}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatQuantity(s.quantity)} {item.unit}
                  </td>
                </tr>
              ))}
            {item.stocks.every((s) => Number(s.quantity) === 0) && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                  Sem saldo em nenhum depósito.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Movimentações</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Depósito</th>
              <th className="px-4 py-3 text-right">Quantidade</th>
              <th className="px-4 py-3 text-right">Custo unit.</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-slate-500">{m.movementDate.slice(0, 10)}</td>
                <td className={`px-4 py-2 ${m.type === "INBOUND" ? "text-emerald-400" : "text-amber-400"}`}>
                  {m.type === "INBOUND" ? "Entrada" : "Saída"}
                </td>
                <td className="px-4 py-2 text-slate-400">{warehouseLabel.get(m.warehouseId) ?? "—"}</td>
                <td className="px-4 py-2 text-right">{formatQuantity(m.quantity)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(m.unitCost)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(m.totalCost)}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma movimentação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {transfers.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Transferências</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">De</th>
                <th className="px-4 py-3">Para</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-slate-500">{t.transferDate.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-slate-400">{warehouseLabel.get(t.fromWarehouseId) ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{warehouseLabel.get(t.toWarehouseId) ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatQuantity(t.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showInbound && (
        <Modal title="Registrar entrada de estoque" onClose={() => setShowInbound(false)}>
          <InboundForm
            warehouses={activeWarehouses}
            accounts={analyticAccounts}
            error={formError}
            isSubmitting={inboundMutation.isPending}
            onClose={() => setShowInbound(false)}
            onSubmit={(values) => inboundMutation.mutate(values)}
          />
        </Modal>
      )}

      {showOutbound && (
        <Modal title="Registrar saída de estoque" onClose={() => setShowOutbound(false)}>
          <OutboundForm
            warehouses={activeWarehouses}
            accounts={analyticAccounts}
            error={formError}
            isSubmitting={outboundMutation.isPending}
            onClose={() => setShowOutbound(false)}
            onSubmit={(values) => outboundMutation.mutate(values)}
          />
        </Modal>
      )}

      {showTransfer && (
        <Modal title="Transferir entre depósitos" onClose={() => setShowTransfer(false)}>
          <TransferForm
            warehouses={activeWarehouses}
            error={formError}
            isSubmitting={transferMutation.isPending}
            onClose={() => setShowTransfer(false)}
            onSubmit={(values) => transferMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function InboundForm({
  warehouses,
  accounts,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouses: Warehouse[];
  accounts: Account[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: InboundValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InboundValues>({ resolver: zodResolver(inboundSchema), defaultValues: { movementDate: today } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="Depósito" {...register("warehouseId")} error={errors.warehouseId?.message}>
        <option value="">selecione</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantidade" type="number" step="0.001" {...register("quantity")} error={errors.quantity?.message} />
        <Input label="Custo unitário" type="number" step="0.0001" {...register("unitCost")} error={errors.unitCost?.message} />
      </div>
      <Select label="Contrapartida (crédito)" {...register("counterAccountId")} error={errors.counterAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Input label="Data" type="date" {...register("movementDate")} error={errors.movementDate?.message} />
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

function OutboundForm({
  warehouses,
  accounts,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouses: Warehouse[];
  accounts: Account[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: OutboundValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OutboundValues>({ resolver: zodResolver(outboundSchema), defaultValues: { movementDate: today } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="Depósito" {...register("warehouseId")} error={errors.warehouseId?.message}>
        <option value="">selecione</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </Select>
      <Input label="Quantidade" type="number" step="0.001" {...register("quantity")} error={errors.quantity?.message} />
      <Select label="Contrapartida (débito — despesa/CPV)" {...register("counterAccountId")} error={errors.counterAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Input label="Data" type="date" {...register("movementDate")} error={errors.movementDate?.message} />
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

function TransferForm({
  warehouses,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouses: Warehouse[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: TransferValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferValues>({ resolver: zodResolver(transferSchema), defaultValues: { transferDate: today } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select label="De" {...register("fromWarehouseId")} error={errors.fromWarehouseId?.message}>
        <option value="">selecione</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </Select>
      <Select label="Para" {...register("toWarehouseId")} error={errors.toWarehouseId?.message}>
        <option value="">selecione</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code} — {w.name}
          </option>
        ))}
      </Select>
      <Input label="Quantidade" type="number" step="0.001" {...register("quantity")} error={errors.quantity?.message} />
      <Input label="Data" type="date" {...register("transferDate")} error={errors.transferDate?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Transferir"}
        </Button>
      </div>
    </form>
  );
}
