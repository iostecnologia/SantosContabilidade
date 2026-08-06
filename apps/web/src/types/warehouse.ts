export interface Warehouse {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  isActive?: boolean;
}

export interface WarehouseStock {
  id: string;
  organizationId: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  warehouse: Warehouse;
}

export type StockMovementType = "INBOUND" | "OUTBOUND";

export interface StockMovement {
  id: string;
  organizationId: string;
  itemId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: string;
  unitCost: string;
  totalCost: string;
  counterAccountId: string;
  movementDate: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  organizationId: string;
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  transferDate: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  unit: string;
  inventoryAccountId: string;
  averageCost: string;
  totalQuantity: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stocks: WarehouseStock[];
  movements?: StockMovement[];
  transfers?: StockTransfer[];
}

export interface CreateInventoryItemInput {
  code: string;
  name: string;
  unit: string;
  inventoryAccountId: string;
}

export interface UpdateInventoryItemInput {
  name?: string;
  unit?: string;
  isActive?: boolean;
}

export interface RegisterInboundInput {
  warehouseId: string;
  quantity: number;
  unitCost: number;
  counterAccountId: string;
  movementDate: string;
}

export interface RegisterOutboundInput {
  warehouseId: string;
  quantity: number;
  counterAccountId: string;
  movementDate: string;
}

export interface RegisterTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  transferDate: string;
}
