import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { WarehousesService } from "./warehouses.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";

// Sem rota DELETE de propósito: DELETE é revogado de app_user na tabela
// `warehouses`. Depósitos não usados mais são desativados via PATCH { isActive: false }.
@ApiTags("warehouses")
@ApiBearerAuth()
@Controller("warehouses")
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermission("warehouses:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("warehouses:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("warehouses:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(user.organizationId, id, dto);
  }
}
