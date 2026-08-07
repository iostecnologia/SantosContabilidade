import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { PayrollRunService } from "./payroll-run.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";

@ApiTags("payroll-runs")
@ApiBearerAuth()
@Controller("payroll-runs")
export class PayrollRunController {
  constructor(private readonly payrollRunService: PayrollRunService) {}

  @Get()
  @RequirePermission("payroll_runs:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollRunService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("payroll_runs:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payrollRunService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("payroll_runs:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayrollRunDto) {
    return this.payrollRunService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/calculate")
  @RequirePermission("payroll_runs:create")
  calculate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payrollRunService.calculate(user.organizationId, id);
  }

  @Post(":id/post")
  @RequirePermission("payroll_runs:post")
  post(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payrollRunService.post(user.organizationId, user.id, id);
  }

  @Delete(":id")
  @RequirePermission("payroll_runs:create")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payrollRunService.remove(user.organizationId, id);
  }
}
