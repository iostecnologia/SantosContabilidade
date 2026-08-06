import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { SetUserRolesDto } from "./dto/set-user-roles.dto";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission("users:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("users:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("users:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.organizationId, id, dto);
  }

  @Put(":id/roles")
  @RequirePermission("users:update")
  setRoles(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetUserRolesDto) {
    return this.usersService.setRoles(user.organizationId, id, dto.roleIds);
  }
}
