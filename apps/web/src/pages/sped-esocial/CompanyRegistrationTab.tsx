import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPatch, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import type { CompanyRegistration, UpdateCompanyRegistrationInput } from "../../types/sped-esocial";

const schema = z.object({
  legalNatureCode: z.string().max(10).optional(),
  cnaeCode: z.string().max(10).optional(),
  stateRegistration: z.string().max(20).optional(),
  municipalRegistration: z.string().max(20).optional(),
  esocialTaxClassCode: z.string().max(4).optional(),
  fpasCode: z.string().max(10).optional(),
  ratCode: z.coerce.number().min(1).max(3).optional(),
  fapRate: z.coerce.number().min(0).optional(),
  thirdPartiesCode: z.string().max(10).optional(),
  addressStreet: z.string().max(160).optional(),
  addressNumber: z.string().max(20).optional(),
  addressComplement: z.string().max(80).optional(),
  addressNeighborhood: z.string().max(80).optional(),
  addressCity: z.string().max(80).optional(),
  addressCityIbgeCode: z.string().max(7).optional(),
  addressState: z.string().max(2).optional(),
  addressZipCode: z.string().max(10).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  accountantName: z.string().max(160).optional(),
  accountantCpf: z.string().max(20).optional(),
  accountantCrc: z.string().max(20).optional(),
});
type Values = z.infer<typeof schema>;

const FIELD_GROUPS: { title: string; fields: { key: keyof Values; label: string }[] }[] = [
  {
    title: "Dados cadastrais",
    fields: [
      { key: "legalNatureCode", label: "Natureza jurídica (código)" },
      { key: "cnaeCode", label: "CNAE" },
      { key: "stateRegistration", label: "Inscrição estadual" },
      { key: "municipalRegistration", label: "Inscrição municipal" },
    ],
  },
  {
    title: "eSocial — S-1000 (empregador)",
    fields: [
      { key: "esocialTaxClassCode", label: "Classificação tributária (eSocial)" },
      { key: "fpasCode", label: "Código FPAS" },
      { key: "ratCode", label: "Código RAT (1 a 3)" },
      { key: "fapRate", label: "FAP" },
      { key: "thirdPartiesCode", label: "Código de terceiros" },
    ],
  },
  {
    title: "Endereço (S-1005)",
    fields: [
      { key: "addressStreet", label: "Logradouro" },
      { key: "addressNumber", label: "Número" },
      { key: "addressComplement", label: "Complemento" },
      { key: "addressNeighborhood", label: "Bairro" },
      { key: "addressCity", label: "Cidade" },
      { key: "addressCityIbgeCode", label: "Código IBGE do município" },
      { key: "addressState", label: "UF" },
      { key: "addressZipCode", label: "CEP" },
    ],
  },
  {
    title: "Contato e contador responsável",
    fields: [
      { key: "phone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "accountantName", label: "Nome do contador" },
      { key: "accountantCpf", label: "CPF do contador" },
      { key: "accountantCrc", label: "CRC do contador" },
    ],
  },
];

export function CompanyRegistrationTab() {
  const queryClient = useQueryClient();
  const { data: registration } = useQuery({
    queryKey: ["company-registration"],
    queryFn: () => apiGet<CompanyRegistration>("/company-registration"),
  });
  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateCompanyRegistrationInput) => apiPatch<CompanyRegistration>("/company-registration", values),
    onSuccess: (updated) => {
      queryClient.setQueryData(["company-registration"], updated);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao salvar cadastro."),
  });

  if (!registration) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-amber-400">
          Estes dados alimentam os registros de abertura do SPED (Bloco 0) e os eventos não-periódicos do eSocial
          (S-1000/S-1005). Preencha antes de gerar os arquivos — a geração avisa quais campos estão faltando em vez
          de falhar silenciosamente.
        </p>
      </Card>
      <RegistrationForm
        registration={registration}
        error={formError}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => {
          const cleaned = { ...values };
          for (const key of Object.keys(values) as (keyof Values)[]) {
            if (cleaned[key] === "") delete cleaned[key];
          }
          updateMutation.mutate(cleaned);
        }}
      />
    </div>
  );
}

function RegistrationForm({
  registration,
  error,
  isSubmitting,
  onSubmit,
}: {
  registration: CompanyRegistration;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: Values) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalNatureCode: registration.legalNatureCode ?? "",
      cnaeCode: registration.cnaeCode ?? "",
      stateRegistration: registration.stateRegistration ?? "",
      municipalRegistration: registration.municipalRegistration ?? "",
      esocialTaxClassCode: registration.esocialTaxClassCode ?? "",
      fpasCode: registration.fpasCode ?? "",
      ratCode: registration.ratCode ?? undefined,
      fapRate: registration.fapRate ? Number(registration.fapRate) : undefined,
      thirdPartiesCode: registration.thirdPartiesCode ?? "",
      addressStreet: registration.addressStreet ?? "",
      addressNumber: registration.addressNumber ?? "",
      addressComplement: registration.addressComplement ?? "",
      addressNeighborhood: registration.addressNeighborhood ?? "",
      addressCity: registration.addressCity ?? "",
      addressCityIbgeCode: registration.addressCityIbgeCode ?? "",
      addressState: registration.addressState ?? "",
      addressZipCode: registration.addressZipCode ?? "",
      phone: registration.phone ?? "",
      email: registration.email ?? "",
      accountantName: registration.accountantName ?? "",
      accountantCpf: registration.accountantCpf ?? "",
      accountantCrc: registration.accountantCrc ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {FIELD_GROUPS.map((group) => (
        <Card key={group.title}>
          <h2 className="mb-4 text-sm font-semibold text-slate-200">{group.title}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.fields.map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                {...register(key)}
                error={errors[key]?.message as string | undefined}
              />
            ))}
          </div>
        </Card>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar cadastro"}
        </Button>
      </div>
    </form>
  );
}
