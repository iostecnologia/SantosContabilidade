import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Pencil, XCircle } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { Account, CostCenter } from "../../types/accounting";
import type { DisposeFixedAssetInput, FixedAsset, UpdateFixedAssetInput } from "../../types/fixed-assets";

function formatCurrency(value: string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  FULLY_DEPRECIATED: "Depreciado",
  DISPOSED: "Baixado",
};

const editSchema = z.object({
  description: z.string().min(1, "Obrigatório").max(500),
  costCenterId: z.string().optional(),
  residualValue: z.coerce.number().min(0).optional(),
  usefulLifeMonths: z.coerce.number().int().min(1).optional(),
});
type EditValues = z.infer<typeof editSchema>;

const disposeSchema = z.object({
  disposalDate: z.string().min(1, "Obrigatório"),
  lossOnDisposalAccountId: z.string().min(1, "Obrigatório"),
});
type DisposeValues = z.infer<typeof disposeSchema>;

export function FixedAssetDetail({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: asset } = useQuery({ queryKey: ["fixed-assets", assetId], queryFn: () => apiGet<FixedAsset>(`/fixed-assets/${assetId}`) });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cost-centers"], queryFn: () => apiGet<CostCenter[]>("/cost-centers") });

  const [editing, setEditing] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fixed-assets", assetId] });
    queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
  };

  const editMutation = useMutation({
    mutationFn: (values: UpdateFixedAssetInput) => apiPatch<FixedAsset>(`/fixed-assets/${assetId}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar ativo."),
  });

  const disposeMutation = useMutation({
    mutationFn: (values: DisposeFixedAssetInput) => apiPost<FixedAsset>(`/fixed-assets/${assetId}/dispose`, values),
    onSuccess: () => {
      invalidate();
      setDisposing(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao dar baixa no ativo."),
  });

  if (!asset) {
    return null;
  }

  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);
  const activeCostCenters = costCenters.filter((cc) => cc.isActive);
  const bookValue = Number(asset.acquisitionCost) - Number(asset.accumulatedDepreciation);
  const entries = [...asset.depreciationEntries].sort((a, b) => b.competenceMonth.localeCompare(a.competenceMonth));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Nº {asset.assetNumber} — {asset.description}
          </h1>
          <p className="text-sm text-slate-400">
            {STATUS_LABELS[asset.status] ?? asset.status} · Valor contábil: {formatCurrency(bookValue.toFixed(2))}
          </p>
        </div>
        <div className="flex gap-2">
          {asset.status !== "DISPOSED" && hasPermission("fixed_assets:update") && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setEditing(true);
              }}
            >
              <Pencil size={16} /> Editar
            </Button>
          )}
          {asset.status !== "DISPOSED" && hasPermission("fixed_assets:dispose") && (
            <Button
              variant="danger"
              onClick={() => {
                setFormError(null);
                setDisposing(true);
              }}
            >
              <XCircle size={16} /> Dar baixa
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase text-slate-500">Custo de aquisição</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(asset.acquisitionCost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Valor residual</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(asset.residualValue)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Depreciação acumulada</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(asset.accumulatedDepreciation)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Vida útil</p>
          <p className="mt-1 text-lg font-semibold">{asset.usefulLifeMonths} meses</p>
        </Card>
      </div>

      {asset.status === "DISPOSED" && (
        <Card>
          <p className="text-sm text-slate-400">
            Baixado em {asset.disposalDate?.slice(0, 10)}.
          </p>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Depreciações lançadas</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-slate-400">{e.competenceMonth.slice(0, 7)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(e.amount)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma depreciação lançada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Modal title="Editar ativo" onClose={() => setEditing(false)}>
          <EditForm
            asset={asset}
            costCenters={activeCostCenters}
            error={formError}
            isSubmitting={editMutation.isPending}
            onClose={() => setEditing(false)}
            onSubmit={(values) => editMutation.mutate({ ...values, costCenterId: values.costCenterId || undefined })}
          />
        </Modal>
      )}

      {disposing && (
        <Modal title={`Dar baixa no ativo nº ${asset.assetNumber}`} onClose={() => setDisposing(false)}>
          <DisposeForm
            accounts={analyticAccounts}
            error={formError}
            isSubmitting={disposeMutation.isPending}
            onClose={() => setDisposing(false)}
            onSubmit={(values) => disposeMutation.mutate(values)}
          />
        </Modal>
      )}
    </div>
  );
}

function EditForm({
  asset,
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  asset: FixedAsset;
  costCenters: CostCenter[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: EditValues) => void;
}) {
  const hasDepreciation = asset.depreciationEntries.length > 0;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      description: asset.description,
      costCenterId: asset.costCenterId ?? "",
      residualValue: Number(asset.residualValue),
      usefulLifeMonths: asset.usefulLifeMonths,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Descrição" {...register("description")} error={errors.description?.message} />
      <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
        <option value="">nenhum</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Valor residual"
          type="number"
          step="0.01"
          disabled={hasDepreciation}
          {...register("residualValue")}
          error={errors.residualValue?.message}
        />
        <Input
          label="Vida útil (meses)"
          type="number"
          disabled={hasDepreciation}
          {...register("usefulLifeMonths")}
          error={errors.usefulLifeMonths?.message}
        />
      </div>
      {hasDepreciation && (
        <p className="text-xs text-slate-500">
          Valor residual e vida útil não podem ser alterados: este ativo já tem depreciação lançada.
        </p>
      )}
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

function DisposeForm({
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
  onSubmit: (values: DisposeValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DisposeValues>({ resolver: zodResolver(disposeSchema), defaultValues: { disposalDate: today } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Baixa por write-off puro (sem valor de venda/proceeds): estorna a depreciação acumulada e lança o valor
        contábil restante como perda.
      </p>
      <Input label="Data da baixa" type="date" {...register("disposalDate")} error={errors.disposalDate?.message} />
      <Select label="Conta de perda na baixa" {...register("lossOnDisposalAccountId")} error={errors.lossOnDisposalAccountId?.message}>
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
        <Button type="submit" variant="danger" disabled={isSubmitting}>
          {isSubmitting ? "Processando..." : "Confirmar baixa"}
        </Button>
      </div>
    </form>
  );
}
