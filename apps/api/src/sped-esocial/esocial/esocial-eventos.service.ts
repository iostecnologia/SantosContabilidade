import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../../tenancy/tenancy.module";
import { TipoEventoEsocial } from "./domain/tipo-evento-esocial";
import { buildEsocialEventId } from "./xml/esocial-xml.util";
import { gerarXmlS1000 } from "./xml/s1000-xml-builder";
import { gerarXmlS1005 } from "./xml/s1005-xml-builder";
import { gerarXmlS1200 } from "./xml/s1200-xml-builder";
import { gerarXmlS2200 } from "./xml/s2200-xml-builder";
import { gerarXmlS2230 } from "./xml/s2230-xml-builder";
import { gerarXmlS2299 } from "./xml/s2299-xml-builder";
import { SetSubmissionProtocolDto } from "./dto/set-submission-protocol.dto";

// Motivo de desligamento (tabela 19 do eSocial) — mapeamento aproximado a
// partir do TerminationType já modelado no Departamento Pessoal; sinalizado
// como aproximação porque a tabela real tem granularidade maior (ex.: culpa
// recíproca, término de contrato a termo, aposentadoria) que este sistema
// não distingue.
const MTV_DESLIG_POR_TIPO: Record<string, string> = {
  WITHOUT_CAUSE: "02",
  RESIGNATION: "11",
  WITH_CAUSE: "01",
  MUTUAL_AGREEMENT: "03",
};

@Injectable()
export class EsocialEventosService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.esocialEvento.findMany({
      where: { organizationId },
      orderBy: { sequenceNumber: "desc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const evento = await this.tx.esocialEvento.findFirst({ where: { id, organizationId } });
    if (!evento) {
      throw new NotFoundException("Evento eSocial não encontrado.");
    }
    return evento;
  }

  async setSubmissionProtocol(organizationId: string, id: string, dto: SetSubmissionProtocolDto) {
    await this.findOneOrThrow(organizationId, id);
    return this.tx.esocialEvento.update({
      where: { id },
      data: { status: "ENVIADO", submissionProtocol: dto.submissionProtocol },
    });
  }

  private async nextSequence(organizationId: string): Promise<bigint> {
    const rows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'esocial_evento', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (rows.length !== 1) {
      throw new ConflictException("Não foi possível gerar o número sequencial do evento eSocial.");
    }
    return rows[0].current_value;
  }

  private persistir(
    organizationId: string,
    userId: string,
    sequenceNumber: bigint,
    eventType: TipoEventoEsocial,
    xmlContent: string,
    options: { employeeId?: string; referenceModule?: string; referenceId?: string; competenceDate?: Date } = {},
  ) {
    return this.tx.esocialEvento.create({
      data: {
        organizationId,
        sequenceNumber,
        eventType,
        xmlContent,
        employeeId: options.employeeId,
        referenceModule: options.referenceModule,
        referenceId: options.referenceId,
        competenceDate: options.competenceDate,
        createdBy: userId,
      },
    });
  }

  private async getOrganizationCnpj(organizationId: string): Promise<string> {
    const organization = await this.tx.organization.findFirstOrThrow({ where: { id: organizationId } });
    if (!organization.taxId) {
      throw new BadRequestException("Cadastre o CNPJ da organização antes de gerar eventos eSocial.");
    }
    return organization.taxId;
  }

  async gerarS1000(organizationId: string, userId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const registration = await this.tx.companyRegistration.findFirst({ where: { organizationId } });
    const faltando: string[] = [];
    if (!registration?.esocialTaxClassCode) faltando.push("classificação tributária (eSocial)");
    if (!registration?.fpasCode) faltando.push("código FPAS");
    if (registration?.ratCode == null) faltando.push("código RAT");
    if (registration?.fapRate == null) faltando.push("FAP");
    if (faltando.length > 0) {
      throw new BadRequestException(`Complete o cadastro da empresa antes de gerar o S-1000: ${faltando.join(", ")}.`);
    }

    const sequenceNumber = await this.nextSequence(organizationId);
    const xmlContent = gerarXmlS1000(
      {
        cnpj,
        esocialTaxClassCode: registration!.esocialTaxClassCode!,
        fpasCode: registration!.fpasCode!,
        ratCode: registration!.ratCode!,
        fapRate: Number(registration!.fapRate),
        thirdPartiesCode: registration!.thirdPartiesCode,
      },
      buildEsocialEventId(cnpj, Number(sequenceNumber)),
    );
    return this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_1000_INFO_EMPREGADOR, xmlContent, {
      referenceModule: "COMPANY_REGISTRATION",
      referenceId: registration!.id,
    });
  }

  async gerarS1005(organizationId: string, userId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const organization = await this.tx.organization.findFirstOrThrow({ where: { id: organizationId } });
    const registration = await this.tx.companyRegistration.findFirst({ where: { organizationId } });
    const faltando: string[] = [];
    if (!registration?.cnaeCode) faltando.push("CNAE");
    if (!registration?.addressStreet) faltando.push("logradouro");
    if (!registration?.addressNeighborhood) faltando.push("bairro");
    if (!registration?.addressCityIbgeCode) faltando.push("código IBGE do município");
    if (!registration?.addressState) faltando.push("UF");
    if (!registration?.addressZipCode) faltando.push("CEP");
    if (faltando.length > 0) {
      throw new BadRequestException(`Complete o endereço da empresa antes de gerar o S-1005: ${faltando.join(", ")}.`);
    }

    const sequenceNumber = await this.nextSequence(organizationId);
    const xmlContent = gerarXmlS1005(
      {
        cnpj,
        razaoSocial: organization.name,
        cnaeCode: registration!.cnaeCode!,
        addressStreet: registration!.addressStreet!,
        addressNumber: registration!.addressNumber,
        addressNeighborhood: registration!.addressNeighborhood!,
        addressCityIbgeCode: registration!.addressCityIbgeCode!,
        addressState: registration!.addressState!,
        addressZipCode: registration!.addressZipCode!,
      },
      buildEsocialEventId(cnpj, Number(sequenceNumber)),
    );
    return this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_1005_ESTABELECIMENTOS, xmlContent, {
      referenceModule: "COMPANY_REGISTRATION",
      referenceId: registration!.id,
    });
  }

  private validarCamposEsocialFuncionario(employee: {
    pis: string | null;
    birthDate: Date | null;
    sex: string | null;
    ctpsNumber: string | null;
    ctpsSeries: string | null;
    cboCode: string | null;
    esocialCategoryCode: number | null;
    addressStreet: string | null;
    addressNeighborhood: string | null;
    addressCityIbgeCode: string | null;
    addressState: string | null;
    addressZipCode: string | null;
  }): string[] {
    const faltando: string[] = [];
    if (!employee.pis) faltando.push("PIS");
    if (!employee.birthDate) faltando.push("data de nascimento");
    if (!employee.sex) faltando.push("sexo");
    if (!employee.ctpsNumber) faltando.push("número da CTPS");
    if (!employee.ctpsSeries) faltando.push("série da CTPS");
    if (!employee.cboCode) faltando.push("código CBO");
    if (employee.esocialCategoryCode == null) faltando.push("categoria eSocial");
    if (!employee.addressStreet) faltando.push("logradouro");
    if (!employee.addressNeighborhood) faltando.push("bairro");
    if (!employee.addressCityIbgeCode) faltando.push("código IBGE do município");
    if (!employee.addressState) faltando.push("UF");
    if (!employee.addressZipCode) faltando.push("CEP");
    return faltando;
  }

  async gerarS2200(organizationId: string, userId: string, employeeId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const employee = await this.tx.employee.findFirst({ where: { id: employeeId, organizationId } });
    if (!employee) {
      throw new NotFoundException("Funcionário não encontrado.");
    }
    const faltando = this.validarCamposEsocialFuncionario(employee);
    if (faltando.length > 0) {
      throw new BadRequestException(`Complete o cadastro do funcionário antes de gerar o S-2200: ${faltando.join(", ")}.`);
    }

    const sequenceNumber = await this.nextSequence(organizationId);
    const xmlContent = gerarXmlS2200(
      {
        cnpj,
        registrationNumber: employee.registrationNumber.toString(),
        cpf: employee.cpf,
        fullName: employee.fullName,
        birthDate: employee.birthDate!,
        sex: employee.sex!,
        pis: employee.pis!,
        ctpsNumber: employee.ctpsNumber!,
        ctpsSeries: employee.ctpsSeries!,
        addressStreet: employee.addressStreet!,
        addressNumber: employee.addressNumber,
        addressNeighborhood: employee.addressNeighborhood!,
        addressCityIbgeCode: employee.addressCityIbgeCode!,
        addressState: employee.addressState!,
        addressZipCode: employee.addressZipCode!,
        admissionDate: employee.admissionDate,
        cboCode: employee.cboCode!,
        esocialCategoryCode: employee.esocialCategoryCode!,
        baseSalary: Number(employee.baseSalary),
      },
      buildEsocialEventId(cnpj, Number(sequenceNumber)),
    );
    return this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_2200_ADMISSAO, xmlContent, {
      employeeId: employee.id,
      referenceModule: "EMPLOYEE",
      referenceId: employee.id,
      competenceDate: employee.admissionDate,
    });
  }

  async gerarS2230Ferias(organizationId: string, userId: string, vacationId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const vacation = await this.tx.vacation.findFirst({ where: { id: vacationId, organizationId }, include: { employee: true } });
    if (!vacation) {
      throw new NotFoundException("Férias não encontradas.");
    }
    if (!vacation.employee.pis) {
      throw new BadRequestException("Complete o PIS do funcionário antes de gerar o S-2230.");
    }
    const returnDate = new Date(vacation.startDate);
    returnDate.setDate(returnDate.getDate() + vacation.daysTaken);

    const sequenceNumber = await this.nextSequence(organizationId);
    const xmlContent = gerarXmlS2230(
      {
        cnpj,
        registrationNumber: vacation.employee.registrationNumber.toString(),
        cpf: vacation.employee.cpf,
        startDate: vacation.startDate,
        returnDate,
      },
      buildEsocialEventId(cnpj, Number(sequenceNumber)),
    );
    return this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_2230_AFASTAMENTO, xmlContent, {
      employeeId: vacation.employeeId,
      referenceModule: "VACATION",
      referenceId: vacation.id,
      competenceDate: vacation.startDate,
    });
  }

  async gerarS2299(organizationId: string, userId: string, terminationId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const termination = await this.tx.termination.findFirst({ where: { id: terminationId, organizationId }, include: { employee: true } });
    if (!termination) {
      throw new NotFoundException("Rescisão não encontrada.");
    }
    const mtvDeslig = MTV_DESLIG_POR_TIPO[termination.type];
    if (!mtvDeslig) {
      throw new BadRequestException(`Não há mapeamento de motivo de desligamento eSocial para o tipo "${termination.type}".`);
    }

    const sequenceNumber = await this.nextSequence(organizationId);
    const xmlContent = gerarXmlS2299(
      {
        cnpj,
        registrationNumber: termination.employee.registrationNumber.toString(),
        cpf: termination.employee.cpf,
        terminationDate: termination.terminationDate,
        mtvDeslig,
      },
      buildEsocialEventId(cnpj, Number(sequenceNumber)),
    );
    return this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_2299_DESLIGAMENTO, xmlContent, {
      employeeId: termination.employeeId,
      referenceModule: "TERMINATION",
      referenceId: termination.id,
      competenceDate: termination.terminationDate,
    });
  }

  async gerarS1200(organizationId: string, userId: string, payrollRunId: string) {
    const cnpj = await this.getOrganizationCnpj(organizationId);
    const payrollRun = await this.tx.payrollRun.findFirst({
      where: { id: payrollRunId, organizationId },
      include: { lines: { include: { employee: true } } },
    });
    if (!payrollRun) {
      throw new NotFoundException("Folha de pagamento não encontrada.");
    }
    if (payrollRun.lines.length === 0) {
      throw new BadRequestException("Folha de pagamento sem linhas — nada para gerar.");
    }
    const semCategoria = payrollRun.lines.filter((linha) => linha.employee.esocialCategoryCode == null);
    if (semCategoria.length > 0) {
      throw new BadRequestException(
        `Complete a categoria eSocial dos funcionários antes de gerar o S-1200: ${semCategoria.map((l) => l.employee.fullName).join(", ")}.`,
      );
    }

    const eventos = [];
    for (const linha of payrollRun.lines) {
      const sequenceNumber = await this.nextSequence(organizationId);
      const xmlContent = gerarXmlS1200(
        {
          cnpj,
          registrationNumber: linha.employee.registrationNumber.toString(),
          cpf: linha.employee.cpf,
          esocialCategoryCode: linha.employee.esocialCategoryCode!,
          competenceYear: payrollRun.competenceYear,
          competenceMonth: payrollRun.competenceMonth,
          baseSalary: Number(linha.baseSalary),
        },
        buildEsocialEventId(cnpj, Number(sequenceNumber)),
      );
      const evento = await this.persistir(organizationId, userId, sequenceNumber, TipoEventoEsocial.S_1200_REMUNERACAO, xmlContent, {
        employeeId: linha.employeeId,
        referenceModule: "PAYROLL_RUN_LINE",
        referenceId: linha.id,
        competenceDate: new Date(payrollRun.competenceYear, payrollRun.competenceMonth - 1, 1),
      });
      eventos.push(evento);
    }
    return eventos;
  }
}
