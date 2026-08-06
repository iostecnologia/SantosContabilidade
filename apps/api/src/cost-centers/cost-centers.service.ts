import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@Injectable()
export class CostCentersService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.costCenter.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
  }

  async create(organizationId: string, dto: CreateCostCenterDto) {
    if (dto.parentId) {
      await this.findOneOrThrow(organizationId, dto.parentId);
    }
    try {
      return await this.tx.costCenter.create({
        data: { organizationId, code: dto.code, name: dto.name, parentId: dto.parentId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe um centro de custo com este código nesta organização.");
      }
      throw err;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateCostCenterDto) {
    await this.findOneOrThrow(organizationId, id);
    return this.tx.costCenter.update({ where: { id }, data: { name: dto.name, isActive: dto.isActive } });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.findOneOrThrow(organizationId, id);

    const hasChildren = await this.tx.costCenter.findFirst({ where: { organizationId, parentId: id } });
    if (hasChildren) {
      throw new ConflictException("Centro de custo possui filhos; remova-os primeiro.");
    }

    try {
      await this.tx.costCenter.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException("Centro de custo está em uso e não pode ser removido; desative-o.");
      }
      throw err;
    }
  }

  private async findOneOrThrow(organizationId: string, id: string) {
    const costCenter = await this.tx.costCenter.findFirst({ where: { id, organizationId } });
    if (!costCenter) {
      throw new NotFoundException("Centro de custo não encontrado.");
    }
    return costCenter;
  }
}
