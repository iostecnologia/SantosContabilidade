import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { InventoryItem, Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { JournalEntriesService } from "../journal-entries/journal-entries.service";
import { WarehousesService } from "../warehouses/warehouses.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { RegisterInboundDto } from "./dto/register-inbound.dto";
import { RegisterOutboundDto } from "./dto/register-outbound.dto";
import { RegisterTransferDto } from "./dto/register-transfer.dto";

/**
 * Custeio por média ponderada móvel, global por item (não por depósito) —
 * ver comentário em InventoryItem no schema. Entrada e saída sempre postam
 * lançamento (débito/crédito na conta de estoque do item); transferência
 * entre depósitos nunca posta (mesma conta contábil nos dois lados) nem
 * muda custo médio/quantidade total, só redistribui saldo entre depósitos.
 * Correção de um movimento já registrado é sempre por um novo movimento em
 * sentido contrário — não há edição/remoção de histórico.
 */
@Injectable()
export class InventoryItemsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionAdapter>,
    private readonly journalEntries: JournalEntriesService,
    private readonly warehouses: WarehousesService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.inventoryItem.findMany({
      where: { organizationId },
      include: { stocks: { include: { warehouse: true } } },
      orderBy: { code: "asc" },
    });
  }

  async findOneOrThrow(organizationId: string, id: string) {
    const item = await this.tx.inventoryItem.findFirst({
      where: { id, organizationId },
      include: {
        stocks: { include: { warehouse: true } },
        movements: { orderBy: { createdAt: "desc" } },
        transfers: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!item) {
      throw new NotFoundException("Item de estoque não encontrado.");
    }
    return item;
  }

  async create(organizationId: string, dto: CreateInventoryItemDto) {
    await this.ensureAccountUsable(organizationId, dto.inventoryAccountId);
    const item = await this.tx.inventoryItem.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        inventoryAccountId: dto.inventoryAccountId,
      },
    });
    return this.findOneOrThrow(organizationId, item.id);
  }

  async update(organizationId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.findOneOrThrow(organizationId, id);
    await this.tx.inventoryItem.update({
      where: { id },
      data: { name: dto.name, unit: dto.unit, isActive: dto.isActive },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async registerInbound(organizationId: string, userId: string, itemId: string, dto: RegisterInboundDto) {
    const item = await this.getActiveItemOrThrow(organizationId, itemId);
    const warehouse = await this.getActiveWarehouseOrThrow(organizationId, dto.warehouseId);
    await this.ensureAccountUsable(organizationId, dto.counterAccountId);

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitCost = new Prisma.Decimal(dto.unitCost);
    const newTotalQuantity = item.totalQuantity.plus(quantity);
    const newAverageCost = item.totalQuantity
      .times(item.averageCost)
      .plus(quantity.times(unitCost))
      .dividedBy(newTotalQuantity)
      .toDecimalPlaces(4);
    const totalCost = quantity.times(unitCost).toDecimalPlaces(2);

    const movementId = uuidv7();
    const journalEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.movementDate,
      competenceDate: dto.movementDate,
      description: `Entrada de estoque — ${item.code} ${item.name} (${warehouse.code})`,
      referenceModule: "INVENTORY",
      referenceId: movementId,
      lines: [
        { accountId: item.inventoryAccountId, direction: "DEBIT", amount: totalCost.toNumber() },
        { accountId: dto.counterAccountId, direction: "CREDIT", amount: totalCost.toNumber() },
      ],
    });

    await this.tx.stockMovement.create({
      data: {
        id: movementId,
        organizationId,
        itemId,
        warehouseId: dto.warehouseId,
        type: "INBOUND",
        quantity,
        unitCost,
        totalCost,
        counterAccountId: dto.counterAccountId,
        movementDate: new Date(dto.movementDate),
        journalEntryId: journalEntry.id,
        createdBy: userId,
      },
    });

    await this.upsertWarehouseStock(organizationId, itemId, dto.warehouseId, quantity);

    await this.tx.inventoryItem.update({
      where: { id: itemId },
      data: { totalQuantity: newTotalQuantity, averageCost: newAverageCost },
    });

    return this.findOneOrThrow(organizationId, itemId);
  }

  async registerOutbound(organizationId: string, userId: string, itemId: string, dto: RegisterOutboundDto) {
    const item = await this.getActiveItemOrThrow(organizationId, itemId);
    const warehouse = await this.getActiveWarehouseOrThrow(organizationId, dto.warehouseId);
    await this.ensureAccountUsable(organizationId, dto.counterAccountId);

    if (item.averageCost.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Item sem custo médio definido; registre uma entrada antes de dar saída.");
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    await this.decrementWarehouseStock(organizationId, itemId, dto.warehouseId, quantity, "Saldo insuficiente no depósito para esta saída.");

    const unitCost = item.averageCost;
    const totalCost = quantity.times(unitCost).toDecimalPlaces(2);

    const movementId = uuidv7();
    const journalEntry = await this.journalEntries.create(organizationId, userId, {
      entryDate: dto.movementDate,
      competenceDate: dto.movementDate,
      description: `Saída de estoque — ${item.code} ${item.name} (${warehouse.code})`,
      referenceModule: "INVENTORY",
      referenceId: movementId,
      lines: [
        { accountId: dto.counterAccountId, direction: "DEBIT", amount: totalCost.toNumber() },
        { accountId: item.inventoryAccountId, direction: "CREDIT", amount: totalCost.toNumber() },
      ],
    });

    await this.tx.stockMovement.create({
      data: {
        id: movementId,
        organizationId,
        itemId,
        warehouseId: dto.warehouseId,
        type: "OUTBOUND",
        quantity,
        unitCost,
        totalCost,
        counterAccountId: dto.counterAccountId,
        movementDate: new Date(dto.movementDate),
        journalEntryId: journalEntry.id,
        createdBy: userId,
      },
    });

    await this.tx.inventoryItem.update({
      where: { id: itemId },
      data: { totalQuantity: item.totalQuantity.minus(quantity) },
    });

    return this.findOneOrThrow(organizationId, itemId);
  }

  async registerTransfer(organizationId: string, userId: string, itemId: string, dto: RegisterTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Depósito de origem e destino devem ser diferentes.");
    }
    await this.getActiveItemOrThrow(organizationId, itemId);
    await this.getActiveWarehouseOrThrow(organizationId, dto.fromWarehouseId);
    await this.getActiveWarehouseOrThrow(organizationId, dto.toWarehouseId);

    const quantity = new Prisma.Decimal(dto.quantity);
    await this.decrementWarehouseStock(
      organizationId,
      itemId,
      dto.fromWarehouseId,
      quantity,
      "Saldo insuficiente no depósito de origem para esta transferência.",
    );
    await this.upsertWarehouseStock(organizationId, itemId, dto.toWarehouseId, quantity);

    await this.tx.stockTransfer.create({
      data: {
        organizationId,
        itemId,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        quantity,
        transferDate: new Date(dto.transferDate),
        createdBy: userId,
      },
    });

    return this.findOneOrThrow(organizationId, itemId);
  }

  private async getActiveItemOrThrow(organizationId: string, itemId: string): Promise<InventoryItem> {
    const item = await this.tx.inventoryItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) {
      throw new NotFoundException("Item de estoque não encontrado.");
    }
    if (!item.isActive) {
      throw new BadRequestException("Item de estoque está inativo.");
    }
    return item;
  }

  private async getActiveWarehouseOrThrow(organizationId: string, warehouseId: string) {
    const warehouse = await this.warehouses.findOneOrThrow(organizationId, warehouseId);
    if (!warehouse.isActive) {
      throw new BadRequestException("Depósito está inativo.");
    }
    return warehouse;
  }

  private async upsertWarehouseStock(
    organizationId: string,
    itemId: string,
    warehouseId: string,
    quantity: Prisma.Decimal,
  ): Promise<void> {
    await this.tx.warehouseStock.upsert({
      where: { organizationId_itemId_warehouseId: { organizationId, itemId, warehouseId } },
      create: { organizationId, itemId, warehouseId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  // Guarda de saldo + decremento em UM único UPDATE atômico: sob movimentos
  // concorrentes, o lock de linha do Postgres serializa as tentativas — mesmo
  // padrão de AccountsPayableService.registerPayment.
  private async decrementWarehouseStock(
    organizationId: string,
    itemId: string,
    warehouseId: string,
    quantity: Prisma.Decimal,
    conflictMessage: string,
  ): Promise<void> {
    const rows = await this.tx.$queryRaw<{ quantity: unknown }[]>`
      UPDATE warehouse_stock
      SET quantity = quantity - ${quantity}
      WHERE organization_id = ${organizationId} AND item_id = ${itemId} AND warehouse_id = ${warehouseId}
        AND quantity >= ${quantity}
      RETURNING quantity
    `;
    if (rows.length !== 1) {
      throw new ConflictException(conflictMessage);
    }
  }

  private async ensureAccountUsable(organizationId: string, accountId: string): Promise<void> {
    const account = await this.tx.account.findFirst({ where: { id: accountId, organizationId } });
    if (!account) {
      throw new BadRequestException("Conta contábil inválida para esta organização.");
    }
    if (!account.isAnalytic || !account.isActive) {
      throw new BadRequestException("Conta contábil precisa ser analítica e estar ativa.");
    }
  }
}
