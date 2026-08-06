import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from "../../lib/api-client";
import { useAuth } from "../../contexts/auth-context";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
import type { CreateRoleInput, CreateUserInput, Permission, Role, UpdateUserInput, User } from "../../types/access-control";
import { CreateRoleForm } from "./RolesTab";

const createSchema = z.object({
  fullName: z.string().min(1, "Obrigatório").max(160),
  email: z.string().email("E-mail inválido").max(160),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  fullName: z.string().min(1, "Obrigatório").max(160),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

export function UsersTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/users") });
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => apiGet<Role[]>("/roles") });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [managingRoles, setManagingRoles] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateUserInput) => apiPost<User>("/users", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar usuário."),
  });

  const editMutation = useMutation({
    mutationFn: (values: UpdateUserInput) => apiPatch<User>(`/users/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar usuário."),
  });

  const setRolesMutation = useMutation({
    mutationFn: (roleIds: string[]) => apiPut<User>(`/users/${managingRoles?.id}/roles`, { roleIds }),
    onSuccess: () => {
      invalidate();
      setManagingRoles(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar papéis."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Usuários</h2>
        {hasPermission("users:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo usuário
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papéis</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{u.fullName}</td>
                <td className="px-4 py-2 text-slate-400">{u.email}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.userRoles.map((ur) => (
                      <span key={ur.role.id} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                        {ur.role.name}
                      </span>
                    ))}
                    {u.userRoles.length === 0 && <span className="text-xs text-slate-600">sem papel</span>}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className={u.isActive ? "text-emerald-400" : "text-slate-500"}>
                    {u.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {hasPermission("users:update") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setEditing(u);
                        }}
                        className="text-slate-400 hover:text-slate-100"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {hasPermission("users:update") && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setManagingRoles(u);
                        }}
                        className="text-slate-400 hover:text-emerald-400"
                        title="Gerenciar papéis"
                      >
                        <ShieldCheck size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo usuário" onClose={() => setCreating(false)}>
          <CreateUserForm
            roles={roles}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar "${editing.fullName}"`} onClose={() => setEditing(null)}>
          <EditUserForm
            user={editing}
            error={formError}
            isSubmitting={editMutation.isPending}
            onClose={() => setEditing(null)}
            onSubmit={(values) => editMutation.mutate(values)}
          />
        </Modal>
      )}

      {managingRoles && (
        <Modal title={`Papéis — ${managingRoles.fullName}`} onClose={() => setManagingRoles(null)}>
          <ManageRolesForm
            user={managingRoles}
            roles={roles}
            error={formError}
            isSubmitting={setRolesMutation.isPending}
            onClose={() => setManagingRoles(null)}
            onSubmit={(roleIds) => setRolesMutation.mutate(roleIds)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateUserForm({
  roles,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  roles: Role[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [creatingRole, setCreatingRole] = useState(false);
  const queryClient = useQueryClient();
  const { data: catalog = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiGet<Permission[]>("/permissions"),
  });

  const createRoleMutation = useMutation({
    mutationFn: (values: CreateRoleInput) => apiPost<Role>("/roles", values),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRoleIds((prev) => new Set(prev).add(role.id));
      setCreatingRole(false);
    },
  });

  const toggleRole = (id: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <form
        onSubmit={handleSubmit((values) => onSubmit({ ...values, roleIds: [...selectedRoleIds] }))}
        className="flex flex-col gap-4"
      >
        <Input label="Nome completo" {...register("fullName")} error={errors.fullName?.message} />
        <Input label="E-mail" type="email" {...register("email")} error={errors.email?.message} />
        <Input label="Senha" type="password" {...register("password")} error={errors.password?.message} />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Papéis</span>
            <button
              type="button"
              onClick={() => setCreatingRole(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              + Novo papel
            </button>
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-slate-800 p-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.has(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                />
                {role.name}
              </label>
            ))}
            {roles.length === 0 && <p className="text-xs text-slate-500">Nenhum papel cadastrado ainda.</p>}
          </div>
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

      {creatingRole && (
        <Modal title="Novo papel" onClose={() => setCreatingRole(false)}>
          <CreateRoleForm
            catalog={catalog}
            error={createRoleMutation.error instanceof ApiError ? createRoleMutation.error.message : null}
            isSubmitting={createRoleMutation.isPending}
            onClose={() => setCreatingRole(false)}
            onSubmit={(values) => createRoleMutation.mutate(values)}
          />
        </Modal>
      )}
    </>
  );
}

function EditUserForm({
  user,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  user: User;
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
    defaultValues: { fullName: user.fullName, isActive: user.isActive },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Nome completo" {...register("fullName")} error={errors.fullName?.message} />
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

function ManageRolesForm({
  user,
  roles,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  user: User;
  roles: Role[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (roleIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(user.userRoles.map((ur) => ur.role.id)));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border border-slate-800 p-2">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={selected.has(role.id)}
              onChange={() => toggle(role.id)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900"
            />
            {role.name}
          </label>
        ))}
        {roles.length === 0 && <p className="text-xs text-slate-500">Nenhum papel cadastrado.</p>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={() => onSubmit([...selected])}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
