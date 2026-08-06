import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CreateRoleInput, Permission, Role } from "../../types/access-control";
import { PermissionCheckboxGrid } from "./PermissionCheckboxGrid";

const nameSchema = z.object({ name: z.string().min(1, "Obrigatório").max(120) });
type NameValues = z.infer<typeof nameSchema>;

export function RolesTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => apiGet<Role[]>("/roles") });
  const { data: catalog = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiGet<Permission[]>("/permissions"),
  });

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Role | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Role | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["roles"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateRoleInput) => apiPost<Role>("/roles", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar papel."),
  });

  const renameMutation = useMutation({
    mutationFn: (values: NameValues) => apiPatch<Role>(`/roles/${renaming?.id}`, values),
    onSuccess: () => {
      invalidate();
      setRenaming(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao renomear papel."),
  });

  const setPermissionsMutation = useMutation({
    mutationFn: (permissionKeys: string[]) =>
      apiPut<Role>(`/roles/${editingPermissions?.id}/permissions`, { permissionKeys }),
    onSuccess: () => {
      invalidate();
      setEditingPermissions(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar permissões."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/roles/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao remover papel."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Papéis</h2>
        {hasPermission("roles:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo papel
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3 text-right">Permissões</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem && (
                      <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                        <Lock size={12} /> sistema
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-slate-400">{role.rolePermissions.length}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {hasPermission("roles:update") && !role.isSystem && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setRenaming(role);
                        }}
                        className="text-slate-400 hover:text-slate-100"
                        title="Renomear"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {hasPermission("roles:update") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setEditingPermissions(role);
                        }}
                        className="text-slate-400 hover:text-emerald-400"
                        title={role.isSystem ? "Ver permissões (papel de sistema, somente leitura)" : "Editar permissões"}
                      >
                        <ShieldCheck size={16} />
                      </button>
                    )}
                    {hasPermission("roles:delete") && !role.isSystem && (
                      <button
                        onClick={() => window.confirm(`Remover o papel "${role.name}"?`) && deleteMutation.mutate(role.id)}
                        className="text-slate-400 hover:text-red-400"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhum papel cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo papel" onClose={() => setCreating(false)}>
          <CreateRoleForm
            catalog={catalog}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}

      {renaming && (
        <Modal title={`Renomear "${renaming.name}"`} onClose={() => setRenaming(null)}>
          <RenameForm
            role={renaming}
            error={formError}
            isSubmitting={renameMutation.isPending}
            onClose={() => setRenaming(null)}
            onSubmit={(values) => renameMutation.mutate(values)}
          />
        </Modal>
      )}

      {editingPermissions && (
        <Modal title={`Permissões — ${editingPermissions.name}`} onClose={() => setEditingPermissions(null)}>
          <EditPermissionsForm
            role={editingPermissions}
            catalog={catalog}
            error={formError}
            isSubmitting={setPermissionsMutation.isPending}
            onClose={() => setEditingPermissions(null)}
            onSubmit={(keys) => setPermissionsMutation.mutate(keys)}
          />
        </Modal>
      )}
    </div>
  );
}

export function CreateRoleForm({
  catalog,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  catalog: Permission[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateRoleInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameValues>({ resolver: zodResolver(nameSchema) });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ name: values.name, permissionKeys: [...selected] }))}
      className="flex flex-col gap-4"
    >
      <Input label="Nome do papel" {...register("name")} error={errors.name?.message} />
      <div className="flex flex-col gap-1">
        <span className="text-sm text-slate-400">Permissões</span>
        <PermissionCheckboxGrid catalog={catalog} selected={selected} onChange={setSelected} />
      </div>
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

function RenameForm({
  role,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  role: Role;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: NameValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: role.name } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Nome do papel" {...register("name")} error={errors.name?.message} />
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

function EditPermissionsForm({
  role,
  catalog,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  role: Role;
  catalog: Permission[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (keys: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role.rolePermissions.map((rp) => rp.permission.key)),
  );

  return (
    <div className="flex flex-col gap-4">
      {role.isSystem && (
        <p className="text-xs text-amber-400">
          Papel de sistema — permissões fixas (não podem ser alteradas), exibidas apenas para conferência.
        </p>
      )}
      <PermissionCheckboxGrid catalog={catalog} selected={selected} onChange={setSelected} disabled={role.isSystem} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {role.isSystem ? "Fechar" : "Cancelar"}
        </Button>
        {!role.isSystem && (
          <Button type="button" disabled={isSubmitting} onClick={() => onSubmit([...selected])}>
            {isSubmitting ? "Salvando..." : "Salvar permissões"}
          </Button>
        )}
      </div>
    </div>
  );
}
