import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";

@ApiTags("roles")
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("permissions")
  @RequirePermission("roles:read")
  listPermissionCatalog() {
    return this.rolesService.listPermissionCatalog();
  }

  @Get("roles")
  @RequirePermission("roles:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.list(user.organizationId);
  }

  @Post("roles")
  @RequirePermission("roles:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.organizationId, dto);
  }

  @Patch("roles/:id")
  @RequirePermission("roles:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(user.organizationId, id, dto);
  }

  @Put("roles/:id/permissions")
  @RequirePermission("roles:update")
  setPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setPermissions(user.organizationId, id, dto.permissionKeys);
  }

  @Delete("roles/:id")
  @RequirePermission("roles:delete")
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.rolesService.delete(user.organizationId, id);
  }
}
