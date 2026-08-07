import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ThirteenthSalaryRunService } from "./thirteenth-salary-run.service";
import { CreateThirteenthSalaryRunDto } from "./dto/create-thirteenth-salary-run.dto";

@ApiTags("thirteenth-salary-runs")
@ApiBearerAuth()
@Controller("thirteenth-salary-runs")
export class ThirteenthSalaryRunController {
  constructor(private readonly thirteenthSalaryRunService: ThirteenthSalaryRunService) {}

  @Get()
  @RequirePermission("thirteenth_salary:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.thirteenthSalaryRunService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("thirteenth_salary:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.thirteenthSalaryRunService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("thirteenth_salary:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThirteenthSalaryRunDto) {
    return this.thirteenthSalaryRunService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/calculate")
  @RequirePermission("thirteenth_salary:create")
  calculate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.thirteenthSalaryRunService.calculate(user.organizationId, id);
  }

  @Post(":id/post")
  @RequirePermission("thirteenth_salary:post")
  post(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.thirteenthSalaryRunService.post(user.organizationId, user.id, id);
  }

  @Delete(":id")
  @RequirePermission("thirteenth_salary:create")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.thirteenthSalaryRunService.remove(user.organizationId, id);
  }
}
