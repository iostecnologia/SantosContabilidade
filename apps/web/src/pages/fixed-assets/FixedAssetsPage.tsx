import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Calculator } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter } from "../../types/accounting";
import type { CreateFixedAssetInput, FixedAsset, RunDepreciationResult } from "../../types/fixed-assets";
import { FixedAssetDetail } from "./FixedAssetDetail";

function formatCurrency(value: string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  FULLY_DEPRECIATED: "Depreciado",
  DISPOSED: "Baixado",
};

const createSchema = z.object({
  description: z.string().min(1, "Obrigatório").max(500),
  acquisitionDate: z.string().min(1, "Obrigatório"),
  acquisitionCost: z.coerce.number().positive("Deve ser positivo"),
  residualValue: z.coerce.number().min(0).optional(),
  usefulLifeMonths: z.coerce.number().int().min(1, "Obrigatório"),
  assetAccountId: z.string().min(1, "Obrigatório"),
  accumulatedDepreciationAccountId: z.string().min(1, "Obrigatório"),
  depreciationExpenseAccountId: z.string().min(1, "Obrigatório"),
  costCenterId: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const depreciationSchema = z.object({
  competenceMonth: z.string().min(1, "Obrigatório"),
});
type DepreciationValues = z.infer<typeof depreciationSchema>;

export function FixedAssetsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: assets = [] } = useQuery({ queryKey: ["fixed-assets"], queryFn: () => apiGet<FixedAsset[]>("/fixed-assets") });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [runningDepreciation, setRunningDepreciation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [depreciationResult, setDepreciationResult] = useState<RunDepreciationResult | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateFixedAssetInput) => apiPost<FixedAsset>("/fixed-assets", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar ativo."),
  });

  const depreciationMutation = useMutation({
    mutationFn: (values: DepreciationValues) => apiPost<RunDepreciationResult>("/fixed-assets/depreciation-runs", values),
    onSuccess: (result) => {
      invalidate();
      setDepreciationResult(result);
      setRunningDepreciation(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao rodar depreciação."),
  });

  if (selectedId) {
    return <FixedAssetDetail assetId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const activeCostCenters = costCenters.filter((cc) => cc.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ativo Fixo</h1>
        <div className="flex gap-2">
          {hasPermission("fixed_assets:run_depreciation") && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setDepreciationResult(null);
                setRunningDepreciation(true);
              }}
            >
              <Calculator size={16} /> Rodar depreciação
            </Button>
          )}
          {hasPermission("fixed_assets:create") && (
            <Button
              onClick={() => {
                setFormError(null);
                setCreating(true);
              }}
            >
              <Plus size={16} /> Novo ativo
            </Button>
          )}
        </div>
      </div>

      {depreciationResult && (
        <Card>
          <p className="text-sm text-emerald-400">
            Depreciação de {depreciationResult.competenceMonth.slice(0, 7)}: {depreciationResult.processed.length}{" "}
            {depreciationResult.processed.length === 1 ? "ativo processado" : "ativos processados"}.
          </p>
        </Card>
      )}

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Aquisição</th>
              <th className="px-4 py-3 text-right">Custo</th>
              <th className="px-4 py-3 text-right">Depreciação acumulada</th>
              <th className="px-4 py-3 text-right">Valor contábil</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {assets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                className="cursor-pointer hover:bg-slate-800/40"
              >
                <td className="px-4 py-2 text-slate-400">{asset.assetNumber}</td>
                <td className="px-4 py-2">{asset.description}</td>
                <td className="px-4 py-2 text-slate-400">{asset.acquisitionDate.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(asset.acquisitionCost)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(asset.accumulatedDepreciation)}</td>
                <td className="px-4 py-2 text-right">
                  {formatCurrency((Number(asset.acquisitionCost) - Number(asset.accumulatedDepreciation)).toFixed(2))}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      asset.status === "ACTIVE"
                        ? "text-emerald-400"
                        : asset.status === "DISPOSED"
                          ? "text-red-400"
                          : "text-slate-400"
                    }
                  >
                    {STATUS_LABELS[asset.status] ?? asset.status}
                  </span>
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nenhum ativo fixo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo ativo fixo" onClose={() => setCreating(false)}>
          <CreateForm
            accounts={analyticAccounts}
            costCenters={activeCostCenters}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) =>
              createMutation.mutate({ ...values, costCenterId: values.costCenterId || undefined })
            }
          />
        </Modal>
      )}

      {runningDepreciation && (
        <Modal title="Rodar depreciação do mês" onClose={() => setRunningDepreciation(false)}>
          <DepreciationForm
            error={formError}
            isSubmitting={depreciationMutation.isPending}
            onClose={() => setRunningDepreciation(false)}
            onSubmit={(values) => depreciationMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      <Input label="Descrição" {...register("description")} error={errors.description?.message} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Data de aquisição" type="date" {...register("acquisitionDate")} error={errors.acquisitionDate?.message} />
        <Input label="Custo de aquisição" type="number" step="0.01" {...register("acquisitionCost")} error={errors.acquisitionCost?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor residual" type="number" step="0.01" {...register("residualValue")} error={errors.residualValue?.message} />
        <Input
          label="Vida útil (meses)"
          type="number"
          {...register("usefulLifeMonths")}
          error={errors.usefulLifeMonths?.message}
        />
      </div>
      <Select label="Conta do ativo" {...register("assetAccountId")} error={errors.assetAccountId?.message}>
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select
        label="Conta de depreciação acumulada"
        {...register("accumulatedDepreciationAccountId")}
        error={errors.accumulatedDepreciationAccountId?.message}
      >
        <option value="">selecione</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </Select>
      <Select
        label="Conta de despesa de depreciação"
        {...register("depreciationExpenseAccountId")}
        error={errors.depreciationExpenseAccountId?.message}
      >
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

function DepreciationForm({
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: DepreciationValues) => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DepreciationValues>({
    resolver: zodResolver(depreciationSchema),
    defaultValues: { competenceMonth: `${currentMonth}-01` },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Calcula e lança a depreciação de todos os ativos ativos ainda não processados nesta competência. Ativos já
        processados no mês são ignorados (sem lançamento duplicado).
      </p>
      <Input label="Mês de competência" type="date" {...register("competenceMonth")} error={errors.competenceMonth?.message} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Rodando..." : "Rodar"}
        </Button>
      </div>
    </form>
  );
}
