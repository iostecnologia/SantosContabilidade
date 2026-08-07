import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

@Injectable()
export class EmployeesService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.employee.findMany({
      where: { organizationId },
      include: { costCenter: true },
      orderBy: { fullName: "asc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const employee = await this.tx.employee.findFirst({
      where: { id, organizationId },
      include: { costCenter: true },
    });
    if (!employee) {
      throw new NotFoundException("Funcionário não encontrado.");
    }
    return employee;
  }

  async create(organizationId: string, userId: string, dto: CreateEmployeeDto) {
    if (dto.costCenterId) {
      await this.ensureCostCenterUsable(organizationId, dto.costCenterId);
    }

    // Mesmo padrão de contador atômico de accounts_payable/journal_entries,
    // com counter_key próprio.
    const counterRows = await this.tx.$queryRaw<{ current_value: bigint }[]>`
      INSERT INTO sequence_counters (organization_id, counter_key, current_value)
      VALUES (${organizationId}, 'employee', 1)
      ON CONFLICT (organization_id, counter_key)
      DO UPDATE SET current_value = sequence_counters.current_value + 1
      RETURNING current_value
    `;
    if (counterRows.length !== 1) {
      throw new ConflictException("Não foi possível gerar a matrícula do funcionário.");
    }
    const registrationNumber = counterRows[0].current_value;

    try {
      const employee = await this.tx.employee.create({
        data: {
          organizationId,
          registrationNumber,
          fullName: dto.fullName,
          cpf: dto.cpf,
          admissionDate: new Date(dto.admissionDate),
          position: dto.position,
          costCenterId: dto.costCenterId,
          baseSalary: dto.baseSalary,
          dependentsCount: dto.dependentsCount ?? 0,
          transportVoucherMonthlyValue: dto.transportVoucherMonthlyValue,
          mealVoucherMonthlyValue: dto.mealVoucherMonthlyValue,
          mealVoucherDiscountRate: dto.mealVoucherDiscountRate,
          pis: dto.pis,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          sex: dto.sex,
          ctpsNumber: dto.ctpsNumber,
          ctpsSeries: dto.ctpsSeries,
          cboCode: dto.cboCode,
          esocialCategoryCode: dto.esocialCategoryCode,
          addressStreet: dto.addressStreet,
          addressNumber: dto.addressNumber,
          addressComplement: dto.addressComplement,
          addressNeighborhood: dto.addressNeighborhood,
          addressCity: dto.addressCity,
          addressCityIbgeCode: dto.addressCityIbgeCode,
          addressState: dto.addressState,
          addressZipCode: dto.addressZipCode,
          createdBy: userId,
        },
      });
      return this.findOneOrThrow(organizationId, employee.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe um funcionário com este CPF nesta organização.");
      }
      throw err;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.findOneOrThrow(organizationId, id);
    if (employee.status === "TERMINATED") {
      throw new BadRequestException("Funcionário desligado; cadastro não pode mais ser editado.");
    }
    if (dto.costCenterId) {
      await this.ensureCostCenterUsable(organizationId, dto.costCenterId);
    }

    await this.tx.employee.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        position: dto.position,
        costCenterId: dto.costCenterId,
        baseSalary: dto.baseSalary,
        dependentsCount: dto.dependentsCount,
        transportVoucherMonthlyValue: dto.transportVoucherMonthlyValue,
        mealVoucherMonthlyValue: dto.mealVoucherMonthlyValue,
        mealVoucherDiscountRate: dto.mealVoucherDiscountRate,
        pis: dto.pis,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        sex: dto.sex,
        ctpsNumber: dto.ctpsNumber,
        ctpsSeries: dto.ctpsSeries,
        cboCode: dto.cboCode,
        esocialCategoryCode: dto.esocialCategoryCode,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComplement: dto.addressComplement,
        addressNeighborhood: dto.addressNeighborhood,
        addressCity: dto.addressCity,
        addressCityIbgeCode: dto.addressCityIbgeCode,
        addressState: dto.addressState,
        addressZipCode: dto.addressZipCode,
      },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  private async ensureCostCenterUsable(organizationId: string, costCenterId: string): Promise<void> {
    const costCenter = await this.tx.costCenter.findFirst({ where: { id: costCenterId, organizationId } });
    if (!costCenter) {
      throw new BadRequestException("Centro de custo inválido para esta organização.");
    }
    if (!costCenter.isActive) {
      throw new BadRequestException("Centro de custo precisa estar ativo.");
    }
  }
}
