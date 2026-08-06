import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { InventoryItemsService } from "./inventory-items.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { RegisterInboundDto } from "./dto/register-inbound.dto";
import { RegisterOutboundDto } from "./dto/register-outbound.dto";
import { RegisterTransferDto } from "./dto/register-transfer.dto";

@ApiTags("inventory-items")
@ApiBearerAuth()
@Controller("inventory-items")
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Get()
  @RequirePermission("inventory_items:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryItemsService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("inventory_items:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryItemsService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("inventory_items:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryItemsService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("inventory_items:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryItemsService.update(user.organizationId, id, dto);
  }

  @Post(":id/inbound")
  @RequirePermission("inventory_items:inbound")
  registerInbound(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: RegisterInboundDto) {
    return this.inventoryItemsService.registerInbound(user.organizationId, user.id, id, dto);
  }

  @Post(":id/outbound")
  @RequirePermission("inventory_items:outbound")
  registerOutbound(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: RegisterOutboundDto) {
    return this.inventoryItemsService.registerOutbound(user.organizationId, user.id, id, dto);
  }

  @Post(":id/transfers")
  @RequirePermission("inventory_items:transfer")
  registerTransfer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: RegisterTransferDto) {
    return this.inventoryItemsService.registerTransfer(user.organizationId, user.id, id, dto);
  }
}
