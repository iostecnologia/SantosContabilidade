import { Module } from "@nestjs/common";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { InventoryItemsController } from "./inventory-items.controller";
import { InventoryItemsService } from "./inventory-items.service";

@Module({
  imports: [JournalEntriesModule, WarehousesModule],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService],
  exports: [InventoryItemsService],
})
export class InventoryItemsModule {}
