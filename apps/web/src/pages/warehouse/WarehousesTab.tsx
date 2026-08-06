import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CreateWarehouseInput, UpdateWarehouseInput, Warehouse } from "../../types/warehouse";

const createSchema = z.object({
  code: z.string().min(1, "Obrigatório").max(20),
  name: z.string().min(1, "Obrigatório").max(200),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Obrigatório").max(200),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

export function WarehousesTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiGet<Warehouse[]>("/warehouses") });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["warehouses"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateWarehouseInput) => apiPost<Warehouse>("/warehouses", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar depósito."),
  });

  const editMutation = useMutation({
    mutationFn: (values: UpdateWarehouseInput) => apiPatch<Warehouse>(`/warehouses/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Depósitos</h2>
        {hasPermission("warehouses:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo depósito
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-2 text-slate-300">{w.code}</td>
                <td className="px-4 py-2">{w.name}</td>
                <td className="px-4 py-2">
                  <span className={w.isActive ? "text-emerald-400" : "text-slate-500"}>{w.isActive ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("warehouses:update") && (
                    <button
                      onClick={() => {
                        setFormError(null);
                        setEditing(w);
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
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhum depósito cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo depósito" onClose={() => setCreating(false)}>
          <CreateForm
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
            warehouse={editing}
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
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
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
  warehouse,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouse: Warehouse;
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
    defaultValues: { name: warehouse.name, isActive: warehouse.isActive },
  });

  return (
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
  );
}
