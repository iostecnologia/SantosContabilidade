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
import type { Account, AccountType, CostCenter } from "../../types/accounting";
import { LEGAL_STATEMENT_GROUPS_BY_TYPE } from "../../types/legal-statement-groups";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const createSchema = z.object({
  code: z.string().min(1, "Obrigatório").max(32),
  name: z.string().min(1, "Obrigatório").max(160),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: z.string().optional(),
  costCenterId: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Obrigatório").max(160),
  isActive: z.boolean(),
  costCenterId: z.string().optional(),
  spedReferenceCode: z.string().max(40).optional(),
  legalStatementGroup: z.string().max(60).optional(),
});
type EditValues = z.infer<typeof editSchema>;

interface AccountNode extends Account {
  children: AccountNode[];
}

function buildTree(accounts: Account[]): AccountNode[] {
  const nodes = new Map<string, AccountNode>(accounts.map((a) => [a.id, { ...a, children: [] }]));
  const roots: AccountNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function AccountsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => apiGet<CostCenter[]>("/cost-centers"),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<Account>("/accounts", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar."),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) => apiPatch<Account>(`/accounts/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  const tree = buildTree(accounts);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plano de Contas</h1>
        {hasPermission("accounts:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Nova conta
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Analítica</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tree.map((node) => (
              <AccountRows
                key={node.id}
                node={node}
                depth={0}
                canEdit={hasPermission("accounts:update")}
                onEdit={(acc) => {
                  setFormError(null);
                  setEditing(acc);
                }}
              />
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma conta cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <CreateModal
          accounts={accounts}
          costCenters={costCenters}
          error={formError}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {editing && (
        <EditModal
          account={editing}
          costCenters={costCenters}
          error={formError}
          isSubmitting={editMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(values) => editMutation.mutate(values)}
        />
      )}
    </div>
  );
}

function AccountRows({
  node,
  depth,
  canEdit,
  onEdit,
}: {
  node: AccountNode;
  depth: number;
  canEdit: boolean;
  onEdit: (account: Account) => void;
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-2 text-slate-300" style={{ paddingLeft: `${16 + depth * 20}px` }}>
          {node.code}
        </td>
        <td className="px-4 py-2">{node.name}</td>
        <td className="px-4 py-2 text-slate-500">{node.type}</td>
        <td className="px-4 py-2 text-slate-500">{node.isAnalytic ? "Sim" : "Não"}</td>
        <td className="px-4 py-2">
          <span className={node.isActive ? "text-emerald-400" : "text-slate-500"}>
            {node.isActive ? "Ativa" : "Inativa"}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          {canEdit && (
            <button onClick={() => onEdit(node)} className="text-slate-400 hover:text-slate-100" aria-label="Editar">
              <Pencil size={16} />
            </button>
          )}
        </td>
      </tr>
      {node.children.map((child) => (
        <AccountRows key={child.id} node={child} depth={depth + 1} canEdit={canEdit} onEdit={onEdit} />
      ))}
    </>
  );
}

function CreateModal({
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
    <Modal title="Nova conta contábil" onClose={onClose}>
      <form
        onSubmit={handleSubmit((values) =>
          onSubmit({ ...values, parentId: values.parentId || undefined, costCenterId: values.costCenterId || undefined }),
        )}
        className="flex flex-col gap-4"
      >
        <Input label="Código" {...register("code")} error={errors.code?.message} />
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Select label="Tipo" {...register("type")} error={errors.type?.message}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="Conta pai (opcional)" {...register("parentId")}>
          <option value="">— nenhuma —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
        <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
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
  account,
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  account: Account;
  costCenters: CostCenter[];
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
      name: account.name,
      isActive: account.isActive,
      costCenterId: account.costCenterId ?? "",
      spedReferenceCode: account.spedReferenceCode ?? "",
      legalStatementGroup: account.legalStatementGroup ?? "",
    },
  });
  const groupOptions = LEGAL_STATEMENT_GROUPS_BY_TYPE[account.type];

  return (
    <Modal title={`Editar "${account.code}"`} onClose={onClose}>
      <form
        onSubmit={handleSubmit((values) =>
          onSubmit({
            ...values,
            costCenterId: values.costCenterId || undefined,
            spedReferenceCode: values.spedReferenceCode || undefined,
            legalStatementGroup: values.legalStatementGroup || undefined,
          }),
        )}
        className="flex flex-col gap-4"
      >
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Select label="Centro de custo" {...register("costCenterId")}>
          <option value="">— nenhum —</option>
          {costCenters.map((cc) => (
            <option key={cc.id} value={cc.id}>
              {cc.code} — {cc.name}
            </option>
          ))}
        </Select>
        <Input
          label="Código do plano de contas referencial (SPED)"
          {...register("spedReferenceCode")}
          error={errors.spedReferenceCode?.message}
        />
        <Select label="Grupo do demonstrativo legal (DRE/Balanço)" {...register("legalStatementGroup")}>
          <option value="">— não classificada —</option>
          {groupOptions.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </Select>
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
    </Modal>
  );
}
