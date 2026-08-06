import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

// Sem rota DELETE de propósito: o papel de runtime (app_user) tem DELETE
// revogado na tabela `accounts` no banco. Contas não usadas mais são
// desativadas via PATCH { isActive: false }, nunca removidas — preserva o
// histórico contábil.
@ApiTags("accounts")
@ApiBearerAuth()
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermission("accounts:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("accounts:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("accounts:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(user.organizationId, id, dto);
  }
}
