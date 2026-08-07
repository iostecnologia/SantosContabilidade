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
import type {
  AnexoSimplesNacional,
  FiscalTaxSettings,
  IcmsUfRate,
  SimplesNacionalBracket,
  UpdateFiscalTaxSettingsInput,
} from "../../types/fiscal";

const settingsSchema = z.object({
  regimeTributario: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL"]),
  anexoSimplesNacional: z.enum(["I", "II", "III", "IV", "V"]).optional(),
  receitaBruta12Meses: z.coerce.number().min(0),
  pisCofinsRegime: z.enum(["CUMULATIVO", "NAO_CUMULATIVO"]).optional(),
  pisRate: z.coerce.number().min(0).max(1),
  cofinsRate: z.coerce.number().min(0).max(1),
  issRate: z.coerce.number().min(0).max(1),
  icmsDefaultInternalRate: z.coerce.number().min(0).max(1),
  receitaVendasAccountId: z.string().optional(),
  receitaServicosAccountId: z.string().optional(),
  deducoesTributariasVendasAccountId: z.string().optional(),
  deducoesTributariasServicosAccountId: z.string().optional(),
  clientesAReceberAccountId: z.string().optional(),
  icmsPayableAccountId: z.string().optional(),
  pisPayableAccountId: z.string().optional(),
  cofinsPayableAccountId: z.string().optional(),
  issPayableAccountId: z.string().optional(),
  simplesNacionalPayableAccountId: z.string().optional(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

const ACCOUNT_FIELDS: { key: keyof SettingsValues; label: string }[] = [
  { key: "receitaVendasAccountId", label: "Receita de vendas" },
  { key: "receitaServicosAccountId", label: "Receita de serviços" },
  { key: "clientesAReceberAccountId", label: "Clientes a receber" },
  { key: "deducoesTributariasVendasAccountId", label: "Deduções tributárias sobre vendas" },
  { key: "deducoesTributariasServicosAccountId", label: "Deduções tributárias sobre serviços" },
  { key: "icmsPayableAccountId", label: "ICMS a recolher" },
  { key: "pisPayableAccountId", label: "PIS a recolher" },
  { key: "cofinsPayableAccountId", label: "COFINS a recolher" },
  { key: "issPayableAccountId", label: "ISS a recolher" },
  { key: "simplesNacionalPayableAccountId", label: "Simples Nacional (DAS) a recolher" },
];

export function FiscalSettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["fiscal-tax-settings"],
    queryFn: () => apiGet<FiscalTaxSettings>("/fiscal/tax-settings"),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateFiscalTaxSettingsInput) => apiPatch<FiscalTaxSettings>("/fiscal/tax-settings", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-tax-settings"] });
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
          As faixas do Simples Nacional (Anexo III, 1ª a 3ª) e as alíquotas de PIS/COFINS/ISS/ICMS abaixo foram
          pré-preenchidas como referência — confira contra a legislação vigente antes de emitir documentos reais.
          O cálculo de ICMS não considera NCM, substituição tributária ou redução de base; PIS/COFINS não apuram
          créditos de insumos; ISS usa uma única alíquota por organização.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-200">Regime tributário</h2>
        <SettingsForm
          settings={settings}
          accounts={analyticAccounts}
          error={formError}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Card>

      <SimplesBracketsEditor brackets={settings.simplesBrackets} />
      <IcmsUfRatesEditor rates={settings.icmsUfRates} />
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
  settings: FiscalTaxSettings;
  accounts: Account[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: SettingsValues) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      regimeTributario: settings.regimeTributario,
      anexoSimplesNacional: settings.anexoSimplesNacional ?? undefined,
      receitaBruta12Meses: Number(settings.receitaBruta12Meses),
      pisCofinsRegime: settings.pisCofinsRegime ?? undefined,
      pisRate: Number(settings.pisRate),
      cofinsRate: Number(settings.cofinsRate),
      issRate: Number(settings.issRate),
      icmsDefaultInternalRate: Number(settings.icmsDefaultInternalRate),
      receitaVendasAccountId: settings.receitaVendasAccountId ?? "",
      receitaServicosAccountId: settings.receitaServicosAccountId ?? "",
      deducoesTributariasVendasAccountId: settings.deducoesTributariasVendasAccountId ?? "",
      deducoesTributariasServicosAccountId: settings.deducoesTributariasServicosAccountId ?? "",
      clientesAReceberAccountId: settings.clientesAReceberAccountId ?? "",
      icmsPayableAccountId: settings.icmsPayableAccountId ?? "",
      pisPayableAccountId: settings.pisPayableAccountId ?? "",
      cofinsPayableAccountId: settings.cofinsPayableAccountId ?? "",
      issPayableAccountId: settings.issPayableAccountId ?? "",
      simplesNacionalPayableAccountId: settings.simplesNacionalPayableAccountId ?? "",
    },
  });

  const regime = watch("regimeTributario");

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const cleaned = { ...values };
        for (const { key } of ACCOUNT_FIELDS) {
          if (!cleaned[key]) delete cleaned[key];
        }
        if (!cleaned.anexoSimplesNacional) delete cleaned.anexoSimplesNacional;
        if (!cleaned.pisCofinsRegime) delete cleaned.pisCofinsRegime;
        onSubmit(cleaned);
      })}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Select label="Regime tributário" {...register("regimeTributario")}>
          <option value="SIMPLES_NACIONAL">Simples Nacional</option>
          <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
          <option value="LUCRO_REAL">Lucro Real</option>
        </Select>
        {regime === "SIMPLES_NACIONAL" && (
          <>
            <Select label="Anexo" {...register("anexoSimplesNacional")}>
              <option value="I">I — Comércio</option>
              <option value="II">II — Indústria</option>
              <option value="III">III — Serviços em geral</option>
              <option value="IV">IV — Serviços (sem CPP no DAS)</option>
              <option value="V">V — Serviços (Fator R)</option>
            </Select>
            <Input
              label="RBT12 (receita bruta últimos 12 meses)"
              type="number"
              step="0.01"
              {...register("receitaBruta12Meses")}
              error={errors.receitaBruta12Meses?.message}
            />
          </>
        )}
        {regime !== "SIMPLES_NACIONAL" && (
          <Select label="Regime PIS/COFINS" {...register("pisCofinsRegime")}>
            <option value="CUMULATIVO">Cumulativo (Lucro Presumido)</option>
            <option value="NAO_CUMULATIVO">Não-cumulativo (Lucro Real)</option>
          </Select>
        )}
        <Input label="Alíquota PIS" type="number" step="0.0001" {...register("pisRate")} error={errors.pisRate?.message} />
        <Input label="Alíquota COFINS" type="number" step="0.0001" {...register("cofinsRate")} error={errors.cofinsRate?.message} />
        <Input label="Alíquota ISS" type="number" step="0.0001" {...register("issRate")} error={errors.issRate?.message} />
        <Input
          label="Alíquota ICMS interna padrão"
          type="number"
          step="0.0001"
          {...register("icmsDefaultInternalRate")}
          error={errors.icmsDefaultInternalRate?.message}
        />
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
  rbt12Min: string;
  rbt12Max: string;
  aliquotaNominal: string;
  parcelaDeduzir: string;
  percentualIrpj: string;
  percentualCsll: string;
  percentualCofins: string;
  percentualPis: string;
  percentualCpp: string;
  percentualIcmsOuIss: string;
}

const BRACKET_FIELDS: { key: keyof BracketRow; label: string }[] = [
  { key: "rbt12Min", label: "RBT12 de" },
  { key: "rbt12Max", label: "RBT12 até" },
  { key: "aliquotaNominal", label: "Alíq. nominal" },
  { key: "parcelaDeduzir", label: "Parcela a deduzir" },
  { key: "percentualIrpj", label: "% IRPJ" },
  { key: "percentualCsll", label: "% CSLL" },
  { key: "percentualCofins", label: "% COFINS" },
  { key: "percentualPis", label: "% PIS" },
  { key: "percentualCpp", label: "% CPP" },
  { key: "percentualIcmsOuIss", label: "% ICMS/ISS" },
];

function toBracketRows(brackets: SimplesNacionalBracket[]): BracketRow[] {
  return [...brackets]
    .sort((a, b) => Number(a.rbt12Min) - Number(b.rbt12Min))
    .map((b) => ({
      rbt12Min: b.rbt12Min,
      rbt12Max: b.rbt12Max ?? "",
      aliquotaNominal: b.aliquotaNominal,
      parcelaDeduzir: b.parcelaDeduzir,
      percentualIrpj: b.percentualIrpj,
      percentualCsll: b.percentualCsll,
      percentualCofins: b.percentualCofins,
      percentualPis: b.percentualPis,
      percentualCpp: b.percentualCpp,
      percentualIcmsOuIss: b.percentualIcmsOuIss,
    }));
}

function SimplesBracketsEditor({ brackets }: { brackets: SimplesNacionalBracket[] }) {
  const queryClient = useQueryClient();
  const anexosPresentes = Array.from(new Set(brackets.map((b) => b.anexo)));
  const [anexo, setAnexo] = useState<AnexoSimplesNacional>(anexosPresentes[0] ?? "III");
  const [rows, setRows] = useState<BracketRow[]>(() => toBracketRows(brackets.filter((b) => b.anexo === anexo)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(toBracketRows(brackets.filter((b) => b.anexo === anexo)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexo, brackets.map((b) => b.id).join(",")]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut<FiscalTaxSettings>("/fiscal/tax-settings/simples-brackets", {
        anexo,
        brackets: rows.map((r) => ({
          rbt12Min: Number(r.rbt12Min),
          rbt12Max: r.rbt12Max === "" ? undefined : Number(r.rbt12Max),
          aliquotaNominal: Number(r.aliquotaNominal),
          parcelaDeduzir: Number(r.parcelaDeduzir),
          percentualIrpj: Number(r.percentualIrpj),
          percentualCsll: Number(r.percentualCsll),
          percentualCofins: Number(r.percentualCofins),
          percentualPis: Number(r.percentualPis),
          percentualCpp: Number(r.percentualCpp),
          percentualIcmsOuIss: Number(r.percentualIcmsOuIss),
        })),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["fiscal-tax-settings"], updated);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao salvar tabela."),
  });

  const updateRow = (index: number, field: keyof BracketRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const emptyRow = (): BracketRow => ({
    rbt12Min: "0",
    rbt12Max: "",
    aliquotaNominal: "0",
    parcelaDeduzir: "0",
    percentualIrpj: "0",
    percentualCsll: "0",
    percentualCofins: "0",
    percentualPis: "0",
    percentualCpp: "0",
    percentualIcmsOuIss: "0",
  });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-200">Tabela do Simples Nacional</h2>
          <select
            value={anexo}
            onChange={(e) => setAnexo(e.target.value as AnexoSimplesNacional)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            {["I", "II", "III", "IV", "V"].map((a) => (
              <option key={a} value={a}>
                Anexo {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            <Plus size={16} /> Faixa
          </Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Salvando..." : "Salvar tabela"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              {BRACKET_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row, index) => (
              <tr key={index}>
                {BRACKET_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-1">
                    <input
                      className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      value={row[f.key]}
                      onChange={(e) => updateRow(index, f.key, e.target.value)}
                    />
                  </td>
                ))}
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={BRACKET_FIELDS.length + 1} className="px-2 py-6 text-center text-slate-500">
                  Nenhuma faixa cadastrada para o Anexo {anexo}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Card>
  );
}

function IcmsUfRatesEditor({ rates }: { rates: IcmsUfRate[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<{ uf: string; internalRate: string }[]>(
    () => rates.map((r) => ({ uf: r.uf, internalRate: r.internalRate })),
  );
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut<FiscalTaxSettings>("/fiscal/tax-settings/icms-uf-rates", {
        rates: rows.map((r) => ({ uf: r.uf, internalRate: Number(r.internalRate) })),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["fiscal-tax-settings"], updated);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao salvar alíquotas de ICMS."),
  });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Alíquotas internas de ICMS por UF</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setRows((prev) => [...prev, { uf: "", internalRate: "0.18" }])}>
            <Plus size={16} /> UF
          </Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2">UF</th>
            <th className="px-2 py-2">Alíquota interna</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-2 py-1">
                <input
                  className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 uppercase"
                  maxLength={2}
                  value={row.uf}
                  onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, uf: e.target.value.toUpperCase() } : r)))}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  value={row.internalRate}
                  onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, internalRate: e.target.value } : r)))}
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                Nenhuma UF configurada — usa a alíquota interna padrão.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Card>
  );
}
