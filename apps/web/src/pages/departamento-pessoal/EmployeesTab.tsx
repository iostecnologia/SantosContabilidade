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
import type { CostCenter } from "../../types/accounting";
import type { CreateEmployeeInput, Employee, UpdateEmployeeInput } from "../../types/departamento-pessoal";

function formatCurrency(value: string | number | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const createSchema = z.object({
  fullName: z.string().min(1, "Obrigatório").max(160),
  cpf: z.string().min(1, "Obrigatório").max(20),
  admissionDate: z.string().min(1, "Obrigatório"),
  position: z.string().min(1, "Obrigatório").max(120),
  costCenterId: z.string().optional(),
  baseSalary: z.coerce.number().positive("Deve ser positivo"),
  dependentsCount: z.coerce.number().int().min(0).max(20).optional(),
  transportVoucherMonthlyValue: z.coerce.number().min(0).optional(),
  mealVoucherMonthlyValue: z.coerce.number().min(0).optional(),
  mealVoucherDiscountRate: z.coerce.number().min(0).max(1).optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const esocialFields = {
  pis: z.string().max(14).optional(),
  birthDate: z.string().optional(),
  sex: z.enum(["M", "F"]).optional(),
  ctpsNumber: z.string().max(20).optional(),
  ctpsSeries: z.string().max(10).optional(),
  cboCode: z.string().max(10).optional(),
  esocialCategoryCode: z.coerce.number().int().optional(),
  addressStreet: z.string().max(160).optional(),
  addressNumber: z.string().max(20).optional(),
  addressComplement: z.string().max(80).optional(),
  addressNeighborhood: z.string().max(80).optional(),
  addressCity: z.string().max(80).optional(),
  addressCityIbgeCode: z.string().max(7).optional(),
  addressState: z.string().max(2).optional(),
  addressZipCode: z.string().max(10).optional(),
};

const editSchema = createSchema.omit({ cpf: true, admissionDate: true }).extend(esocialFields);
type EditValues = z.infer<typeof editSchema>;

export function EmployeesTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => apiGet<Employee[]>("/employees") });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => apiGet<CostCenter[]>("/cost-centers"),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["employees"] });

  const createMutation = useMutation({
    mutationFn: (values: CreateEmployeeInput) => apiPost<Employee>("/employees", values),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar funcionário."),
  });

  const editMutation = useMutation({
    mutationFn: (values: UpdateEmployeeInput) => apiPatch<Employee>(`/employees/${editing?.id}`, values),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar funcionário."),
  });

  const activeCostCenters = costCenters.filter((cc) => cc.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Funcionários</h2>
        {hasPermission("employees:create") && (
          <Button
            onClick={() => {
              setFormError(null);
              setCreating(true);
            }}
          >
            <Plus size={16} /> Novo funcionário
          </Button>
        )}
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3 text-right">Salário base</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-slate-400">{e.registrationNumber}</td>
                <td className="px-4 py-2">{e.fullName}</td>
                <td className="px-4 py-2 text-slate-400">{e.position}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(e.baseSalary)}</td>
                <td className="px-4 py-2">
                  <span className={e.status === "ACTIVE" ? "text-emerald-400" : "text-slate-500"}>
                    {e.status === "ACTIVE" ? "Ativo" : "Desligado"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {e.status === "ACTIVE" && hasPermission("employees:update") && (
                    <button
                      onClick={() => {
                        setFormError(null);
                        setEditing(e);
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
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum funcionário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <Modal title="Novo funcionário" onClose={() => setCreating(false)}>
          <CreateForm
            costCenters={activeCostCenters}
            error={formError}
            isSubmitting={createMutation.isPending}
            onClose={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate({ ...values, costCenterId: values.costCenterId || undefined })}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar "${editing.fullName}"`} onClose={() => setEditing(null)}>
          <EditForm
            employee={editing}
            costCenters={activeCostCenters}
            error={formError}
            isSubmitting={editMutation.isPending}
            onClose={() => setEditing(null)}
            onSubmit={(values) => editMutation.mutate({ ...values, costCenterId: values.costCenterId || undefined })}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      <Input label="Nome completo" {...register("fullName")} error={errors.fullName?.message} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="CPF" {...register("cpf")} error={errors.cpf?.message} />
        <Input label="Data de admissão" type="date" {...register("admissionDate")} error={errors.admissionDate?.message} />
      </div>
      <Input label="Cargo" {...register("position")} error={errors.position?.message} />
      <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
        <option value="">nenhum</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Salário base" type="number" step="0.01" {...register("baseSalary")} error={errors.baseSalary?.message} />
        <Input label="Nº de dependentes" type="number" {...register("dependentsCount")} error={errors.dependentsCount?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Vale-transporte (mensal)"
          type="number"
          step="0.01"
          {...register("transportVoucherMonthlyValue")}
          error={errors.transportVoucherMonthlyValue?.message}
        />
        <Input
          label="Vale-refeição/alimentação (mensal)"
          type="number"
          step="0.01"
          {...register("mealVoucherMonthlyValue")}
          error={errors.mealVoucherMonthlyValue?.message}
        />
      </div>
      <Input
        label="Desconto do vale-refeição sobre o funcionário (0 a 1, ex.: 0.2 = 20%)"
        type="number"
        step="0.01"
        {...register("mealVoucherDiscountRate")}
        error={errors.mealVoucherDiscountRate?.message}
      />
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
  employee,
  costCenters,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  employee: Employee;
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
      fullName: employee.fullName,
      position: employee.position,
      costCenterId: employee.costCenterId ?? "",
      baseSalary: Number(employee.baseSalary),
      dependentsCount: employee.dependentsCount,
      transportVoucherMonthlyValue: employee.transportVoucherMonthlyValue ? Number(employee.transportVoucherMonthlyValue) : undefined,
      mealVoucherMonthlyValue: employee.mealVoucherMonthlyValue ? Number(employee.mealVoucherMonthlyValue) : undefined,
      mealVoucherDiscountRate: employee.mealVoucherDiscountRate ? Number(employee.mealVoucherDiscountRate) : undefined,
      pis: employee.pis ?? "",
      birthDate: employee.birthDate ? employee.birthDate.slice(0, 10) : "",
      sex: (employee.sex as "M" | "F" | undefined) ?? undefined,
      ctpsNumber: employee.ctpsNumber ?? "",
      ctpsSeries: employee.ctpsSeries ?? "",
      cboCode: employee.cboCode ?? "",
      esocialCategoryCode: employee.esocialCategoryCode ?? undefined,
      addressStreet: employee.addressStreet ?? "",
      addressNumber: employee.addressNumber ?? "",
      addressComplement: employee.addressComplement ?? "",
      addressNeighborhood: employee.addressNeighborhood ?? "",
      addressCity: employee.addressCity ?? "",
      addressCityIbgeCode: employee.addressCityIbgeCode ?? "",
      addressState: employee.addressState ?? "",
      addressZipCode: employee.addressZipCode ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const cleaned = { ...values };
        for (const key of Object.keys(esocialFields) as (keyof typeof esocialFields)[]) {
          if (cleaned[key] === "") delete cleaned[key];
        }
        onSubmit(cleaned);
      })}
      className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
    >
      <Input label="Nome completo" {...register("fullName")} error={errors.fullName?.message} />
      <Input label="Cargo" {...register("position")} error={errors.position?.message} />
      <Select label="Centro de custo (opcional)" {...register("costCenterId")}>
        <option value="">nenhum</option>
        {costCenters.map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.code} — {cc.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Salário base" type="number" step="0.01" {...register("baseSalary")} error={errors.baseSalary?.message} />
        <Input label="Nº de dependentes" type="number" {...register("dependentsCount")} error={errors.dependentsCount?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Vale-transporte (mensal)"
          type="number"
          step="0.01"
          {...register("transportVoucherMonthlyValue")}
          error={errors.transportVoucherMonthlyValue?.message}
        />
        <Input
          label="Vale-refeição/alimentação (mensal)"
          type="number"
          step="0.01"
          {...register("mealVoucherMonthlyValue")}
          error={errors.mealVoucherMonthlyValue?.message}
        />
      </div>
      <Input
        label="Desconto do vale-refeição sobre o funcionário (0 a 1)"
        type="number"
        step="0.01"
        {...register("mealVoucherDiscountRate")}
        error={errors.mealVoucherDiscountRate?.message}
      />

      <details className="rounded-md border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          Dados para eSocial (opcional — necessários para gerar admissão/remuneração)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="PIS" {...register("pis")} error={errors.pis?.message} />
            <Input label="Data de nascimento" type="date" {...register("birthDate")} error={errors.birthDate?.message} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Sexo" {...register("sex")}>
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </Select>
            <Input label="CTPS nº" {...register("ctpsNumber")} error={errors.ctpsNumber?.message} />
            <Input label="CTPS série" {...register("ctpsSeries")} error={errors.ctpsSeries?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Código CBO" {...register("cboCode")} error={errors.cboCode?.message} />
            <Input
              label="Categoria eSocial (código)"
              type="number"
              {...register("esocialCategoryCode")}
              error={errors.esocialCategoryCode?.message}
            />
          </div>
          <Input label="Logradouro" {...register("addressStreet")} error={errors.addressStreet?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número" {...register("addressNumber")} error={errors.addressNumber?.message} />
            <Input label="Complemento" {...register("addressComplement")} error={errors.addressComplement?.message} />
          </div>
          <Input label="Bairro" {...register("addressNeighborhood")} error={errors.addressNeighborhood?.message} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Cidade" {...register("addressCity")} error={errors.addressCity?.message} />
            <Input
              label="Código IBGE do município"
              {...register("addressCityIbgeCode")}
              error={errors.addressCityIbgeCode?.message}
            />
            <Input label="UF" maxLength={2} {...register("addressState")} error={errors.addressState?.message} />
          </div>
          <Input label="CEP" {...register("addressZipCode")} error={errors.addressZipCode?.message} />
        </div>
      </details>

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
