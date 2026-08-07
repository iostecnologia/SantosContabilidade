export interface CompanyRegistration {
  id: string;
  organizationId: string;
  legalNatureCode: string | null;
  cnaeCode: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  esocialTaxClassCode: string | null;
  fpasCode: string | null;
  ratCode: number | null;
  fapRate: string | null;
  thirdPartiesCode: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressCityIbgeCode: string | null;
  addressState: string | null;
  addressZipCode: string | null;
  phone: string | null;
  email: string | null;
  accountantName: string | null;
  accountantCpf: string | null;
  accountantCrc: string | null;
}

export type UpdateCompanyRegistrationInput = Partial<
  Omit<CompanyRegistration, "id" | "organizationId" | "ratCode" | "fapRate"> & { ratCode?: number; fapRate?: number }
>;

export type EsocialEventoStatus = "GERADO" | "ENVIADO";

export interface EsocialEvento {
  id: string;
  organizationId: string;
  sequenceNumber: string;
  eventType: string;
  employeeId: string | null;
  referenceModule: string | null;
  referenceId: string | null;
  competenceDate: string | null;
  xmlContent: string;
  status: EsocialEventoStatus;
  submissionProtocol: string | null;
  createdBy: string;
  createdAt: string;
}

export interface SetSubmissionProtocolInput {
  submissionProtocol: string;
}

export interface SpedFileResponse {
  nomeArquivo: string;
  conteudo: string;
  [key: string]: unknown;
}
