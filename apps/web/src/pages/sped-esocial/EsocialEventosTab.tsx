import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { Employee, PayrollRun, Termination, Vacation } from "../../types/departamento-pessoal";
import type { EsocialEvento, SetSubmissionProtocolInput } from "../../types/sped-esocial";

function downloadXml(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

const EVENT_LABELS: Record<string, string> = {
  "S-1000": "S-1000 — Info. empregador",
  "S-1005": "S-1005 — Estabelecimentos",
  "S-1200": "S-1200 — Remuneração",
  "S-2200": "S-2200 — Admissão",
  "S-2230": "S-2230 — Afastamento (férias)",
  "S-2299": "S-2299 — Desligamento",
};

export function EsocialEventosTab() {
  const queryClient = useQueryClient();
  const { data: eventos = [] } = useQuery({ queryKey: ["esocial-eventos"], queryFn: () => apiGet<EsocialEvento[]>("/esocial/eventos") });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => apiGet<Employee[]>("/employees") });
  const { data: vacations = [] } = useQuery({ queryKey: ["vacations"], queryFn: () => apiGet<Vacation[]>("/vacations") });
  const { data: terminations = [] } = useQuery({ queryKey: ["terminations"], queryFn: () => apiGet<Termination[]>("/terminations") });
  const { data: payrollRuns = [] } = useQuery({ queryKey: ["payroll-runs"], queryFn: () => apiGet<PayrollRun[]>("/payroll-runs") });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedVacationId, setSelectedVacationId] = useState("");
  const [selectedTerminationId, setSelectedTerminationId] = useState("");
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["esocial-eventos"] });

  const gerarMutation = useMutation({
    mutationFn: (path: string) => apiPost(path),
    onSuccess: () => {
      invalidate();
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Erro ao gerar evento."),
  });

  const protocoloMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SetSubmissionProtocolInput }) =>
      apiPatch<EsocialEvento>(`/esocial/eventos/${id}/protocolo`, dto),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Erro ao registrar protocolo."),
  });

  const sorted = [...eventos].sort((a, b) => Number(b.sequenceNumber) - Number(a.sequenceNumber));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Eventos não-periódicos</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={gerarMutation.isPending} onClick={() => gerarMutation.mutate("/esocial/eventos/info-empregador")}>
            Gerar S-1000
          </Button>
          <Button type="button" disabled={gerarMutation.isPending} onClick={() => gerarMutation.mutate("/esocial/eventos/estabelecimentos")}>
            Gerar S-1005
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Admissão (S-2200)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Funcionário" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
            <option value="">selecione...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.registrationNumber} — {e.fullName}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={!selectedEmployeeId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate(`/esocial/eventos/admissao/${selectedEmployeeId}`)}
          >
            Gerar
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Remuneração mensal (S-1200)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Folha de pagamento" value={selectedPayrollRunId} onChange={(e) => setSelectedPayrollRunId(e.target.value)}>
            <option value="">selecione...</option>
            {payrollRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.competenceMonth}/{r.competenceYear} — {r.status}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={!selectedPayrollRunId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate(`/esocial/eventos/remuneracao/${selectedPayrollRunId}`)}
          >
            Gerar (uma linha por funcionário)
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Férias (S-2230)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Férias" value={selectedVacationId} onChange={(e) => setSelectedVacationId(e.target.value)}>
            <option value="">selecione...</option>
            {vacations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.employee.fullName} — início {v.startDate.slice(0, 10)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={!selectedVacationId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate(`/esocial/eventos/ferias/${selectedVacationId}`)}
          >
            Gerar
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Desligamento (S-2299)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Rescisão" value={selectedTerminationId} onChange={(e) => setSelectedTerminationId(e.target.value)}>
            <option value="">selecione...</option>
            {terminations.map((t) => (
              <option key={t.id} value={t.id}>
                {t.employee.fullName} — {t.terminationDate.slice(0, 10)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={!selectedTerminationId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate(`/esocial/eventos/desligamento/${selectedTerminationId}`)}
          >
            Gerar
          </Button>
        </div>
      </Card>

      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Seq.</th>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((evento) => (
              <EventoRow
                key={evento.id}
                evento={evento}
                onDownload={() => downloadXml(`${evento.eventType}-${evento.sequenceNumber}.xml`, evento.xmlContent)}
                onSetProtocol={(protocol) => protocoloMutation.mutate({ id: evento.id, dto: { submissionProtocol: protocol } })}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum evento eSocial gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function EventoRow({
  evento,
  onDownload,
  onSetProtocol,
}: {
  evento: EsocialEvento;
  onDownload: () => void;
  onSetProtocol: (protocol: string) => void;
}) {
  const [protocol, setProtocol] = useState(evento.submissionProtocol ?? "");

  return (
    <tr>
      <td className="px-4 py-2 text-slate-400">{evento.sequenceNumber}</td>
      <td className="px-4 py-2">{EVENT_LABELS[evento.eventType] ?? evento.eventType}</td>
      <td className="px-4 py-2">
        <span className={evento.status === "ENVIADO" ? "text-emerald-400" : "text-slate-400"}>
          {evento.status === "ENVIADO" ? "Enviado" : "Gerado"}
        </span>
      </td>
      <td className="px-4 py-2">
        {evento.status === "ENVIADO" ? (
          evento.submissionProtocol
        ) : (
          <div className="flex items-center gap-1">
            <input
              className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              placeholder="protocolo"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
            />
            <button
              type="button"
              disabled={!protocol}
              onClick={() => onSetProtocol(protocol)}
              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              salvar
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <button onClick={onDownload} className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400" title="Baixar XML">
          <Download size={16} /> XML
        </button>
      </td>
    </tr>
  );
}
