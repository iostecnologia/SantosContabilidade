import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { VacationService } from "./vacation.service";
import { CreateVacationDto } from "./dto/create-vacation.dto";

@ApiTags("vacations")
@ApiBearerAuth()
@Controller("vacations")
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get()
  @RequirePermission("vacations:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.vacationService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("vacations:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vacationService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("vacations:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVacationDto) {
    return this.vacationService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/calculate")
  @RequirePermission("vacations:create")
  calculate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vacationService.calculate(user.organizationId, id);
  }

  @Post(":id/post")
  @RequirePermission("vacations:post")
  post(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vacationService.post(user.organizationId, user.id, id);
  }

  @Delete(":id")
  @RequirePermission("vacations:create")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vacationService.remove(user.organizationId, id);
  }
}
