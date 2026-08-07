import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { apiGet, apiPatch, apiPut, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { Account } from "../../types/accounting";
import type { PayrollSettings, PayrollTaxBracket, TaxBracketType, UpdatePayrollSettingsInput } from "../../types/departamento-pessoal";

const settingsSchema = z.object({
  irrfDependentDeduction: z.coerce.number().min(0),
  inssCeiling: z.coerce.number().min(0),
  fgtsRate: z.coerce.number().min(0).max(1),
  employerInssRate: z.coerce.number().min(0).max(1),
  fgtsFineRateWithoutCause: z.coerce.number().min(0).max(1),
  fgtsFineRateMutualAgreement: z.coerce.number().min(0).max(1),
  transportVoucherMaxDiscountRate: z.coerce.number().min(0).max(1),
  salaryExpenseAccountId: z.string().optional(),
  salaryPayableAccountId: z.string().optional(),
  inssPayableAccountId: z.string().optional(),
  irrfPayableAccountId: z.string().optional(),
  employerChargesExpenseAccountId: z.string().optional(),
  fgtsPayableAccountId: z.string().optional(),
  employerInssPayableAccountId: z.string().optional(),
  benefitsExpenseAccountId: z.string().optional(),
  benefitsPayableAccountId: z.string().optional(),
  fgtsFineExpenseAccountId: z.string().optional(),
  fgtsFinePayableAccountId: z.string().optional(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

const ACCOUNT_FIELDS: { key: keyof SettingsValues; label: string }[] = [
  { key: "salaryExpenseAccountId", label: "Despesa com salários" },
  { key: "salaryPayableAccountId", label: "Salários a pagar" },
  { key: "inssPayableAccountId", label: "INSS a recolher" },
  { key: "irrfPayableAccountId", label: "IRRF a recolher" },
  { key: "employerChargesExpenseAccountId", label: "Despesa com encargos patronais" },
  { key: "fgtsPayableAccountId", label: "FGTS a recolher" },
  { key: "employerInssPayableAccountId", label: "INSS patronal a recolher" },
  { key: "benefitsExpenseAccountId", label: "Despesa com benefícios" },
  { key: "benefitsPayableAccountId", label: "Benefícios a pagar" },
  { key: "fgtsFineExpenseAccountId", label: "Despesa com multa de FGTS" },
  { key: "fgtsFinePayableAccountId", label: "Multa de FGTS a pagar" },
];

export function PayrollSettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["payroll-settings"],
    queryFn: () => apiGet<PayrollSettings>("/payroll-settings"),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (values: UpdatePayrollSettingsInput) => apiPatch<PayrollSettings>("/payroll-settings", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-settings"] });
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar configurações."),
  });

  const analyticAccounts = accounts.filter((a) => a.isAnalytic && a.isActive);

  if (!settings) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-amber-400">
          Os valores abaixo (tabelas de INSS/IRRF, alíquotas) foram pré-preenchidos como referência e podem não ser os
          vigentes — confira e ajuste conforme a legislação atual antes de rodar a primeira folha real.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-200">Alíquotas e parâmetros</h2>
        <SettingsForm
          settings={settings}
          accounts={analyticAccounts}
          error={formError}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Card>

      <TaxBracketEditor type="INSS" title="Tabela de INSS" brackets={settings.taxBrackets.filter((b) => b.type === "INSS")} />
      <TaxBracketEditor type="IRRF" title="Tabela de IRRF" brackets={settings.taxBrackets.filter((b) => b.type === "IRRF")} />
    </div>
  );
}

function SettingsForm({
  settings,
  accounts,
  error,
  isSubmitting,
  onSubmit,
}: {
  settings: PayrollSettings;
  accounts: Account[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: SettingsValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      irrfDependentDeduction: Number(settings.irrfDependentDeduction),
      inssCeiling: Number(settings.inssCeiling),
      fgtsRate: Number(settings.fgtsRate),
      employerInssRate: Number(settings.employerInssRate),
      fgtsFineRateWithoutCause: Number(settings.fgtsFineRateWithoutCause),
      fgtsFineRateMutualAgreement: Number(settings.fgtsFineRateMutualAgreement),
      transportVoucherMaxDiscountRate: Number(settings.transportVoucherMaxDiscountRate),
      salaryExpenseAccountId: settings.salaryExpenseAccountId ?? "",
      salaryPayableAccountId: settings.salaryPayableAccountId ?? "",
      inssPayableAccountId: settings.inssPayableAccountId ?? "",
      irrfPayableAccountId: settings.irrfPayableAccountId ?? "",
      employerChargesExpenseAccountId: settings.employerChargesExpenseAccountId ?? "",
      fgtsPayableAccountId: settings.fgtsPayableAccountId ?? "",
      employerInssPayableAccountId: settings.employerInssPayableAccountId ?? "",
      benefitsExpenseAccountId: settings.benefitsExpenseAccountId ?? "",
      benefitsPayableAccountId: settings.benefitsPayableAccountId ?? "",
      fgtsFineExpenseAccountId: settings.fgtsFineExpenseAccountId ?? "",
      fgtsFinePayableAccountId: settings.fgtsFinePayableAccountId ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const cleaned = { ...values };
        for (const { key } of ACCOUNT_FIELDS) {
          if (!cleaned[key]) {
            delete cleaned[key];
          }
        }
        onSubmit(cleaned);
      })}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Input label="Dedução por dependente (IRRF)" type="number" step="0.01" {...register("irrfDependentDeduction")} error={errors.irrfDependentDeduction?.message} />
        <Input label="Teto de contribuição (INSS)" type="number" step="0.01" {...register("inssCeiling")} error={errors.inssCeiling?.message} />
        <Input label="Alíquota FGTS" type="number" step="0.0001" {...register("fgtsRate")} error={errors.fgtsRate?.message} />
        <Input label="Alíquota INSS patronal (agregada)" type="number" step="0.0001" {...register("employerInssRate")} error={errors.employerInssRate?.message} />
        <Input label="Multa FGTS — sem justa causa" type="number" step="0.01" {...register("fgtsFineRateWithoutCause")} error={errors.fgtsFineRateWithoutCause?.message} />
        <Input label="Multa FGTS — acordo mútuo" type="number" step="0.01" {...register("fgtsFineRateMutualAgreement")} error={errors.fgtsFineRateMutualAgreement?.message} />
        <Input label="Desconto máx. vale-transporte" type="number" step="0.01" {...register("transportVoucherMaxDiscountRate")} error={errors.transportVoucherMaxDiscountRate?.message} />
      </div>

      <h3 className="mt-2 text-sm font-semibold text-slate-200">Mapeamento contábil</h3>
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNT_FIELDS.map(({ key, label }) => (
          <Select key={key} label={label} {...register(key)}>
            <option value="">não configurado</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}

interface BracketRow {
  minBase: string;
  maxBase: string;
  rate: string;
  deduction: string;
}

function toRows(brackets: PayrollTaxBracket[]): BracketRow[] {
  return [...brackets]
    .sort((a, b) => Number(a.minBase) - Number(b.minBase))
    .map((b) => ({
      minBase: b.minBase,
      maxBase: b.maxBase ?? "",
      rate: b.rate,
      deduction: b.deduction,
    }));
}

function TaxBracketEditor({ type, title, brackets }: { type: TaxBracketType; title: string; brackets: PayrollTaxBracket[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BracketRow[]>(() => toRows(brackets));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(toRows(brackets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brackets.map((b) => b.id).join(",")]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut<PayrollSettings>("/payroll-settings/tax-brackets", {
        type,
        brackets: rows.map((r) => ({
          minBase: Number(r.minBase),
          maxBase: r.maxBase === "" ? undefined : Number(r.maxBase),
          rate: Number(r.rate),
          deduction: Number(r.deduction),
        })),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["payroll-settings"], updated);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao salvar tabela."),
  });

  const updateRow = (index: number, field: keyof BracketRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((prev) => [...prev, { minBase: "0", maxBase: "", rate: "0", deduction: "0" }])}
          >
            <Plus size={16} /> Faixa
          </Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Salvando..." : "Salvar tabela"}
          </Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2">De</th>
            <th className="px-2 py-2">Até (vazio = sem teto)</th>
            <th className="px-2 py-2">Alíquota</th>
            <th className="px-2 py-2">Parcela a deduzir</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-2 py-1">
                <input
                  className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={row.minBase}
                  onChange={(e) => updateRow(index, "minBase", e.target.value)}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={row.maxBase}
                  onChange={(e) => updateRow(index, "maxBase", e.target.value)}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={row.rate}
                  onChange={(e) => updateRow(index, "rate", e.target.value)}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={row.deduction}
                  onChange={(e) => updateRow(index, "deduction", e.target.value)}
                />
              </td>
              <td className="px-2 py-1 text-right">
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Card>
  );
}
