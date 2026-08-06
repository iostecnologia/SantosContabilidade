import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CostCenter } from "../../types/accounting";

const createSchema = z.object({
  code: z.string().min(1, "Obrigatório").max(32),
  name: z.string().min(1, "Obrigatório").max(160),
  parentId: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Obrigatório").max(160),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

export function CostCentersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => apiGet<CostCenter[]>("/cost-centers"),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cost-centers"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<CostCenter>("/cost-centers", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar."),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) => apiPatch<CostCenter>(`/cost-centers/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/cost-centers/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover."),
  });

  const codeById = new Map(costCenters.map((c) => [c.id, c.code]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Centros de Custo</h1>
        {hasPermission("cost_centers:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Pai</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {costCenters.map((cc) => (
              <tr key={cc.id}>
                <td className="px-4 py-2 text-slate-300">{cc.code}</td>
                <td className="px-4 py-2">{cc.name}</td>
                <td className="px-4 py-2 text-slate-500">{cc.parentId ? codeById.get(cc.parentId) : "—"}</td>
                <td className="px-4 py-2">
                  <span className={cc.isActive ? "text-emerald-400" : "text-slate-500"}>
                    {cc.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {hasPermission("cost_centers:update") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setEditing(cc);
                        }}
                        className="text-slate-400 hover:text-slate-100"
                        aria-label="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {hasPermission("cost_centers:delete") && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Remover o centro de custo "${cc.name}"?`)) {
                            deleteMutation.mutate(cc.id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-400"
                        aria-label="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {costCenters.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum centro de custo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <CreateModal
          costCenters={costCenters}
          error={formError}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {editing && (
        <EditModal
          costCenter={editing}
          error={formError}
          isSubmitting={editMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(values) => editMutation.mutate(values)}
        />
      )}
    </div>
  );
}

function CreateModal({
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
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
    <Modal title="Novo centro de custo" onClose={onClose}>
      <form
        onSubmit={handleSubmit((values) => onSubmit({ ...values, parentId: values.parentId || undefined }))}
        className="flex flex-col gap-4"
      >
        <Input label="Código" {...register("code")} error={errors.code?.message} />
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Select label="Centro de custo pai (opcional)" {...register("parentId")}>
          <option value="">— nenhum —</option>
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
    </Modal>
  );
}

function EditModal({
  costCenter,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  costCenter: CostCenter;
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
    defaultValues: { name: costCenter.name, isActive: costCenter.isActive },
  });

  return (
    <Modal title={`Editar "${costCenter.code}"`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
          Ativo
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
    </Modal>
  );
}
