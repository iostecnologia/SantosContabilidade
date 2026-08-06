import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { BudgetService } from "./budget.service";
import { CreateBudgetPlanDto } from "./dto/create-budget-plan.dto";
import { UpdateBudgetPlanDto } from "./dto/update-budget-plan.dto";
import { CreateBudgetLineDto } from "./dto/create-budget-line.dto";
import { UpdateBudgetLineDto } from "./dto/update-budget-line.dto";

@ApiTags("budget")
@ApiBearerAuth()
@Controller("budget-plans")
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @RequirePermission("budget:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("budget:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.budgetService.findOneOrThrow(user.organizationId, id);
  }

  @Get(":id/variance")
  @RequirePermission("budget:read")
  variance(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.budgetService.variance(user.organizationId, id);
  }

  @Post()
  @RequirePermission("budget:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBudgetPlanDto) {
    return this.budgetService.create(user.organizationId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermission("budget:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateBudgetPlanDto) {
    return this.budgetService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermission("budget:delete")
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.budgetService.delete(user.organizationId, id);
  }

  @Post(":id/approve")
  @RequirePermission("budget:approve")
  approve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.budgetService.approve(user.organizationId, user.id, id);
  }

  @Post(":id/close")
  @RequirePermission("budget:close")
  close(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.budgetService.close(user.organizationId, id);
  }

  @Post(":id/lines")
  @RequirePermission("budget:update")
  addLine(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CreateBudgetLineDto) {
    return this.budgetService.addLine(user.organizationId, id, dto);
  }

  @Patch(":id/lines/:lineId")
  @RequirePermission("budget:update")
  updateLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ) {
    return this.budgetService.updateLine(user.organizationId, id, lineId, dto);
  }

  @Delete(":id/lines/:lineId")
  @RequirePermission("budget:update")
  @HttpCode(204)
  async removeLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
  ): Promise<void> {
    await this.budgetService.removeLine(user.organizationId, id, lineId);
  }
}
