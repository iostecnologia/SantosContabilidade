import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

@ApiTags("employees")
@ApiBearerAuth()
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermission("employees:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("employees:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.employeesService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("employees:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.organizationId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermission("employees:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(user.organizationId, id, dto);
  }
}
