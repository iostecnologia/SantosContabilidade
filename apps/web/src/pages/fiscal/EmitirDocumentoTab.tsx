import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calculator, Plus, Send, Trash2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { Counterparty } from "../../types/financeiro";
import type {
  EmitirDocumentoInput,
  FiscalDocumentoEmitido,
  ImpostosApurados,
  NaturezaOperacaoFiscal,
  TipoDocumentoFiscal,
} from "../../types/fiscal";

type TipoEmissao = "VENDA_NFE" | "VENDA_NFCE" | "SERVICO_NFSE";

const TIPO_EMISSAO_OPTIONS: { value: TipoEmissao; label: string; tipo: TipoDocumentoFiscal; natureza: NaturezaOperacaoFiscal }[] = [
  { value: "VENDA_NFE", label: "NF-e — Venda de mercadoria", tipo: "NFE", natureza: "VENDA_MERCADORIA" },
  { value: "VENDA_NFCE", label: "NFC-e — Venda de mercadoria", tipo: "NFCE", natureza: "VENDA_MERCADORIA" },
  { value: "SERVICO_NFSE", label: "NFS-e — Serviço prestado", tipo: "NFSE_NACIONAL", natureza: "SERVICO_PRESTADO" },
];

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const itemSchema = z.object({
  descricao: z.string().min(1, "Obrigatório"),
  quantidade: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().min(0),
  ncm: z.string().optional(),
  ufOrigem: z.string().optional(),
  ufDestino: z.string().optional(),
  codigoServicoMunicipal: z.string().optional(),
});

const formSchema = z.object({
  tipoEmissao: z.enum(["VENDA_NFE", "VENDA_NFCE", "SERVICO_NFSE"]),
  numeroDocumento: z.string().min(1, "Obrigatório"),
  dataEmissao: z.string().min(1, "Obrigatório"),
  dataCompetencia: z.string().min(1, "Obrigatório"),
  fornecedorOuClienteId: z.string().min(1, "Obrigatório"),
  itens: z.array(itemSchema).min(1),
});
type FormValues = z.infer<typeof formSchema>;

export function EmitirDocumentoTab() {
  const { data: counterparties = [] } = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => apiGet<Counterparty[]>("/counterparties"),
  });
  const [impostos, setImpostos] = useState<ImpostosApurados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<FiscalDocumentoEmitido | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipoEmissao: "SERVICO_NFSE",
      dataEmissao: today,
      dataCompetencia: today,
      itens: [{ descricao: "", quantidade: 1, valorUnitario: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "itens" });
  const tipoEmissao = watch("tipoEmissao");
  const isVenda = tipoEmissao === "VENDA_NFE" || tipoEmissao === "VENDA_NFCE";
  const itensAtuais = watch("itens");

  const previewMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const config = TIPO_EMISSAO_OPTIONS.find((o) => o.value === values.tipoEmissao)!;
      return apiPost<ImpostosApurados>("/fiscal/documentos/apuracao-preview", {
        naturezaOperacao: config.natureza,
        itens: values.itens.map((i) => ({
          valorTotal: i.quantidade * i.valorUnitario,
          ncm: i.ncm || undefined,
          ufOrigem: i.ufOrigem || undefined,
          ufDestino: i.ufDestino || undefined,
          codigoServicoMunicipal: i.codigoServicoMunicipal || undefined,
        })),
      });
    },
    onSuccess: (result) => {
      setImpostos(result);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao calcular tributos."),
  });

  const emitirMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const config = TIPO_EMISSAO_OPTIONS.find((o) => o.value === values.tipoEmissao)!;
      const itens = values.itens.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        valorTotal: i.quantidade * i.valorUnitario,
        ncm: i.ncm || undefined,
        ufOrigem: i.ufOrigem || undefined,
        ufDestino: i.ufDestino || undefined,
        codigoServicoMunicipal: i.codigoServicoMunicipal || undefined,
      }));
      const valorTotal = itens.reduce((sum, i) => sum + i.valorTotal, 0);
      const payload: EmitirDocumentoInput = {
        documento: {
          id: values.numeroDocumento,
          tipo: config.tipo,
          naturezaOperacao: config.natureza,
          numeroDocumento: values.numeroDocumento,
          dataEmissao: values.dataEmissao,
          dataCompetencia: values.dataCompetencia,
          fornecedorOuClienteId: values.fornecedorOuClienteId,
          valorTotal,
          itens,
        },
        mapeamentoContabil: {},
      };
      return apiPost<FiscalDocumentoEmitido>("/fiscal/documentos", payload);
    },
    onSuccess: (doc) => {
      setSucesso(doc);
      setError(null);
      setImpostos(null);
      reset({
        tipoEmissao,
        dataEmissao: today,
        dataCompetencia: today,
        numeroDocumento: "",
        fornecedorOuClienteId: "",
        itens: [{ descricao: "", quantidade: 1, valorUnitario: 0 }],
      });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao emitir documento."),
  });

  const valorTotalAtual = (itensAtuais ?? []).reduce((sum, i) => sum + (i.quantidade || 0) * (i.valorUnitario || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select label="Tipo de emissão" {...register("tipoEmissao")}>
              {TIPO_EMISSAO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input label="Número do documento" {...register("numeroDocumento")} error={errors.numeroDocumento?.message} />
            <Input label="Data de emissão" type="date" {...register("dataEmissao")} error={errors.dataEmissao?.message} />
            <Input label="Data de competência" type="date" {...register("dataCompetencia")} error={errors.dataCompetencia?.message} />
          </div>
          <Select label="Cliente" {...register("fornecedorOuClienteId")} error={errors.fornecedorOuClienteId?.message}>
            <option value="">selecione</option>
            {counterparties
              .filter((c) => c.type !== "SUPPLIER")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Itens</h3>
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ descricao: "", quantidade: 1, valorUnitario: 0 })}
            >
              <Plus size={16} /> Item
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-2 rounded-md border border-slate-800 p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Input label="Descrição" {...register(`itens.${index}.descricao`)} error={errors.itens?.[index]?.descricao?.message} />
                <Input label="Quantidade" type="number" step="0.001" {...register(`itens.${index}.quantidade`)} />
                <Input label="Valor unitário" type="number" step="0.01" {...register(`itens.${index}.valorUnitario`)} />
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Total do item</span>
                  <span className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-300">
                    {formatCurrency((itensAtuais?.[index]?.quantidade || 0) * (itensAtuais?.[index]?.valorUnitario || 0))}
                  </span>
                </div>
              </div>
              {isVenda && (
                <div className="grid grid-cols-3 gap-2">
                  <Input label="NCM" {...register(`itens.${index}.ncm`)} />
                  <Input label="UF origem" {...register(`itens.${index}.ufOrigem`)} />
                  <Input label="UF destino" {...register(`itens.${index}.ufDestino`)} />
                </div>
              )}
              {!isVenda && (
                <Input label="Código de serviço municipal" {...register(`itens.${index}.codigoServicoMunicipal`)} />
              )}
              {fields.length > 1 && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => remove(index)} className="text-slate-400 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-sm text-slate-400">
              Valor total: <span className="font-semibold text-slate-200">{formatCurrency(valorTotalAtual)}</span>
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handleSubmit((v) => previewMutation.mutate(v))} disabled={previewMutation.isPending}>
                <Calculator size={16} /> {previewMutation.isPending ? "Calculando..." : "Calcular tributos"}
              </Button>
              <Button type="button" onClick={handleSubmit((v) => emitirMutation.mutate(v))} disabled={emitirMutation.isPending}>
                <Send size={16} /> {emitirMutation.isPending ? "Emitindo..." : "Emitir"}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </Card>

      {impostos && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Tributos apurados</h3>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            {impostos.simplesNacionalDas !== undefined && (
              <div>
                <p className="text-xs uppercase text-slate-500">Simples Nacional (DAS)</p>
                <p className="font-semibold">{formatCurrency(impostos.simplesNacionalDas)}</p>
              </div>
            )}
            {impostos.icms !== undefined && (
              <div>
                <p className="text-xs uppercase text-slate-500">ICMS</p>
                <p className="font-semibold">{formatCurrency(impostos.icms)}</p>
              </div>
            )}
            {impostos.iss !== undefined && (
              <div>
                <p className="text-xs uppercase text-slate-500">ISS</p>
                <p className="font-semibold">{formatCurrency(impostos.iss)}</p>
              </div>
            )}
            {impostos.pis !== undefined && (
              <div>
                <p className="text-xs uppercase text-slate-500">PIS</p>
                <p className="font-semibold">{formatCurrency(impostos.pis)}</p>
              </div>
            )}
            {impostos.cofins !== undefined && (
              <div>
                <p className="text-xs uppercase text-slate-500">COFINS</p>
                <p className="font-semibold">{formatCurrency(impostos.cofins)}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {sucesso && (
        <Card className="border-emerald-800">
          <p className="text-sm text-emerald-400">
            Documento nº {sucesso.numeroDocumento} emitido com sucesso — lançamento contábil gerado. Veja em "Documentos
            Emitidos" para baixar o XML.
          </p>
        </Card>
      )}
    </div>
  );
}
