import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { TerminationService } from "./termination.service";
import { CreateTerminationDto } from "./dto/create-termination.dto";

@ApiTags("terminations")
@ApiBearerAuth()
@Controller("terminations")
export class TerminationController {
  constructor(private readonly terminationService: TerminationService) {}

  @Get()
  @RequirePermission("terminations:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.terminationService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("terminations:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.terminationService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("terminations:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTerminationDto) {
    return this.terminationService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/calculate")
  @RequirePermission("terminations:create")
  calculate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.terminationService.calculate(user.organizationId, id);
  }

  @Post(":id/post")
  @RequirePermission("terminations:post")
  post(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.terminationService.post(user.organizationId, user.id, id);
  }

  @Delete(":id")
  @RequirePermission("terminations:create")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.terminationService.remove(user.organizationId, id);
  }
}
