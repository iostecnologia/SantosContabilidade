import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CostCentersService } from "./cost-centers.service";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@ApiTags("cost-centers")
@ApiBearerAuth()
@Controller("cost-centers")
export class CostCentersController {
  constructor(private readonly costCentersService: CostCentersService) {}

  @Get()
  @RequirePermission("cost_centers:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("cost_centers:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCostCenterDto) {
    return this.costCentersService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("cost_centers:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCostCenterDto) {
    return this.costCentersService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermission("cost_centers:delete")
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.costCentersService.delete(user.organizationId, id);
  }
}
