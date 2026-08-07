import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiGet, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { SpedFileResponse } from "../../types/sped-esocial";

function downloadTxt(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function useGerarArquivo(path: string) {
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: (query: string) => apiGet<SpedFileResponse>(`${path}?${query}`),
    onSuccess: (res) => {
      downloadTxt(res.nomeArquivo, res.conteudo);
      setError(null);
      const novosAvisos: string[] = [];
      if (Array.isArray(res.contasSemMapeamentoReferencial) && res.contasSemMapeamentoReferencial.length > 0) {
        novosAvisos.push(`Contas sem código referencial SPED: ${(res.contasSemMapeamentoReferencial as string[]).join(", ")}`);
      }
      if (typeof res.avisoIpi === "string") novosAvisos.push(res.avisoIpi);
      if (typeof res.avisoLalur === "string") novosAvisos.push(res.avisoLalur);
      setAvisos(novosAvisos);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao gerar arquivo."),
  });
  return { mutation, error, avisos };
}

export function SpedFilesTab() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());

  const ecd = useGerarArquivo("/sped/ecd");
  const efdContribuicoes = useGerarArquivo("/sped/efd-contribuicoes");
  const efdIcmsIpi = useGerarArquivo("/sped/efd-icms-ipi");
  const ecf = useGerarArquivo("/sped/ecf");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-amber-400">
          Os arquivos gerados são para conferência do contador antes de importar no PVA oficial de cada obrigação —
          sem garantia de compatibilidade campo a campo com a versão vigente do leiaute, sem assinatura digital e sem
          transmissão.
        </p>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3 md:w-96">
          <Input label="Ano" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          <Input label="Mês (para EFDs)" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </Card>

      <ArquivoCard
        titulo="ECD — Escrituração Contábil Digital (anual)"
        descricao="Bloco I: plano de contas, mapeamento referencial, saldos e lançamentos do ano-calendário."
        isSubmitting={ecd.mutation.isPending}
        error={ecd.error}
        avisos={ecd.avisos}
        onGerar={() => ecd.mutation.mutate(`year=${year}`)}
      />
      <ArquivoCard
        titulo="EFD-Contribuições (mensal)"
        descricao="PIS/COFINS a partir dos documentos fiscais emitidos no mês."
        isSubmitting={efdContribuicoes.mutation.isPending}
        error={efdContribuicoes.error}
        avisos={efdContribuicoes.avisos}
        onGerar={() => efdContribuicoes.mutation.mutate(`year=${year}&month=${month}`)}
      />
      <ArquivoCard
        titulo="EFD ICMS/IPI (mensal)"
        descricao="Só ICMS — este sistema não apura IPI. Documentos NF-e/NFC-e do mês."
        isSubmitting={efdIcmsIpi.mutation.isPending}
        error={efdIcmsIpi.error}
        avisos={efdIcmsIpi.avisos}
        onGerar={() => efdIcmsIpi.mutation.mutate(`year=${year}&month=${month}`)}
      />
      <ArquivoCard
        titulo="ECF — Escrituração Contábil Fiscal (anual)"
        descricao="Identificação + plano de contas/mapeamento + apuração de resultado. Sem Blocos M/N (LALUR)."
        isSubmitting={ecf.mutation.isPending}
        error={ecf.error}
        avisos={ecf.avisos}
        onGerar={() => ecf.mutation.mutate(`year=${year}`)}
      />
    </div>
  );
}

function ArquivoCard({
  titulo,
  descricao,
  isSubmitting,
  error,
  avisos,
  onGerar,
}: {
  titulo: string;
  descricao: string;
  isSubmitting: boolean;
  error: string | null;
  avisos: string[];
  onGerar: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{titulo}</h2>
          <p className="text-xs text-slate-500">{descricao}</p>
        </div>
        <Button type="button" disabled={isSubmitting} onClick={onGerar}>
          {isSubmitting ? "Gerando..." : "Gerar e baixar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {avisos.map((aviso, i) => (
        <p key={i} className="mt-2 text-xs text-amber-400">
          {aviso}
        </p>
      ))}
    </Card>
  );
}
