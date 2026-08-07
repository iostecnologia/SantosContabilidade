import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { apiGet, ApiError } from "../../lib/api-client";
import { Card } from "../../components/ui/Card";
import type { FiscalDocumentoEmitido, FiscalXmlResponse } from "../../types/fiscal";

const TIPO_LABELS: Record<string, string> = {
  NFE: "NF-e",
  NFCE: "NFC-e",
  NFSE_NACIONAL: "NFS-e",
  NFSE_VIA: "NFS-e",
  CBS: "CBS",
  IBS: "IBS",
};

function formatCurrency(value: string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function downloadXml(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function DocumentosEmitidosTab() {
  const { data: documentos = [] } = useQuery({
    queryKey: ["fiscal-documentos"],
    queryFn: () => apiGet<FiscalDocumentoEmitido[]>("/fiscal/documentos"),
  });

  const xmlMutation = useMutation({
    mutationFn: (id: string) => apiGet<FiscalXmlResponse>(`/fiscal/documentos/${id}/xml`),
    onSuccess: (res) => downloadXml(res.nomeArquivo, res.conteudo),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao gerar XML."),
  });

  const sorted = [...documentos].sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Nº</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((doc) => (
            <tr key={doc.id}>
              <td className="px-4 py-2">{doc.numeroDocumento}</td>
              <td className="px-4 py-2 text-slate-400">{TIPO_LABELS[doc.tipo] ?? doc.tipo}</td>
              <td className="px-4 py-2 text-slate-400">{doc.dataEmissao.slice(0, 10)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(doc.valorTotal)}</td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => xmlMutation.mutate(doc.id)}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400"
                  title="Baixar XML"
                >
                  <Download size={16} /> XML
                </button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Nenhum documento fiscal emitido ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
