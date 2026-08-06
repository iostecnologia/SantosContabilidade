import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.warehouse.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const warehouse = await this.tx.warehouse.findFirst({ where: { id, organizationId } });
    if (!warehouse) {
      throw new NotFoundException("Depósito não encontrado.");
    }
    return warehouse;
  }

  create(organizationId: string, dto: CreateWarehouseDto) {
    return this.tx.warehouse.create({ data: { organizationId, code: dto.code, name: dto.name } });
  }

  async update(organizationId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOneOrThrow(organizationId, id);
    return this.tx.warehouse.update({ where: { id }, data: { name: dto.name, isActive: dto.isActive } });
  }
}
