import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

// Sem rota DELETE de propósito: DELETE é revogado de app_user na tabela
// `bank_accounts`. Contas não usadas mais são desativadas via PATCH { isActive: false }.
@ApiTags("bank-accounts")
@ApiBearerAuth()
@Controller("bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  @RequirePermission("bank_accounts:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("bank_accounts:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("bank_accounts:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(user.organizationId, id, dto);
  }
}
