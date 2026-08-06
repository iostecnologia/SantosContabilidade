import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateCounterpartyDto } from "./dto/create-counterparty.dto";
import { UpdateCounterpartyDto } from "./dto/update-counterparty.dto";

@Injectable()
export class CounterpartiesService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.counterparty.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  }

  async create(organizationId: string, dto: CreateCounterpartyDto) {
    try {
      return await this.tx.counterparty.create({
        data: {
          organizationId,
          type: dto.type,
          taxId: dto.taxId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe uma contraparte com este documento (CPF/CNPJ) nesta organização.");
      }
      throw err;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateCounterpartyDto) {
    await this.findOneOrThrow(organizationId, id);
    return this.tx.counterparty.update({
      where: { id },
      data: { type: dto.type, name: dto.name, email: dto.email, phone: dto.phone, isActive: dto.isActive },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const counterparty = await this.tx.counterparty.findFirst({ where: { id, organizationId } });
    if (!counterparty) {
      throw new NotFoundException("Contraparte não encontrada.");
    }
    return counterparty;
  }
}
