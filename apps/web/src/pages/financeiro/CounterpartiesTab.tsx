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
import type { Counterparty } from "../../types/financeiro";

const TYPES: Counterparty["type"][] = ["SUPPLIER", "CUSTOMER", "BOTH"];
const TYPE_LABELS: Record<Counterparty["type"], string> = {
  SUPPLIER: "Fornecedor",
  CUSTOMER: "Cliente",
  BOTH: "Ambos",
};

const createSchema = z.object({
  type: z.enum(["SUPPLIER", "CUSTOMER", "BOTH"]),
  taxId: z.string().optional(),
  name: z.string().min(1, "Obrigatório").max(160),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = createSchema.extend({ isActive: z.boolean() });
type EditValues = z.infer<typeof editSchema>;

export function CounterpartiesTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: counterparties = [] } = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => apiGet<Counterparty[]>("/counterparties"),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["counterparties"] });

  const clean = (v: CreateValues) => ({ ...v, taxId: v.taxId || undefined, email: v.email || undefined, phone: v.phone || undefined });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiPost<Counterparty>("/counterparties", clean(values)),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar."),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) => apiPatch<Counterparty>(`/counterparties/${editing?.id}`, clean(values)),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Contrapartes</h2>
        {hasPermission("counterparties:create") && (
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
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {counterparties.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2 text-slate-500">{TYPE_LABELS[c.type]}</td>
                <td className="px-4 py-2 text-slate-500">{c.taxId ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{c.email ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={c.isActive ? "text-emerald-400" : "text-slate-500"}>
                    {c.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("counterparties:update") && (
                    <button
                      onClick={() => {
                        setFormError(null);
                        setEditing(c);
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
            {counterparties.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma contraparte cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <CounterpartyModal
          title="Nova contraparte"
          defaultValues={{ type: "SUPPLIER", name: "" }}
          error={formError}
          isSubmitting={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {editing && (
        <CounterpartyModal
          title={`Editar "${editing.name}"`}
          defaultValues={{
            type: editing.type,
            taxId: editing.taxId ?? "",
            name: editing.name,
            email: editing.email ?? "",
            phone: editing.phone ?? "",
            isActive: editing.isActive,
          }}
          error={formError}
          isSubmitting={editMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(values) => editMutation.mutate(values as EditValues)}
          showActiveToggle
        />
      )}
    </div>
  );
}

function CounterpartyModal({
  title,
  defaultValues,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  showActiveToggle,
}: {
  title: string;
  defaultValues: Partial<EditValues>;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreateValues | EditValues) => void;
  showActiveToggle?: boolean;
}) {
  const schema = showActiveToggle ? editSchema : createSchema;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({ resolver: zodResolver(schema as typeof editSchema), defaultValues: defaultValues as EditValues });

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Select label="Tipo" {...register("type")} error={errors.type?.message}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Input label="Nome" {...register("name")} error={errors.name?.message} />
        <Input label="CPF/CNPJ (opcional)" {...register("taxId")} />
        <Input label="E-mail (opcional)" type="email" {...register("email")} error={errors.email?.message} />
        <Input label="Telefone (opcional)" {...register("phone")} />
        {showActiveToggle && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
            Ativo
          </label>
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
    </Modal>
  );
}
