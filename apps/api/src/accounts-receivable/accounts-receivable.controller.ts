import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccountsReceivableService } from "./accounts-receivable.service";
import { CreateAccountsReceivableDto } from "./dto/create-accounts-receivable.dto";
import { RegisterReceiptDto } from "./dto/register-receipt.dto";

// Sem PUT/PATCH de edição genérica de propósito: correção de um título é
// sempre por cancelamento (estorna o acréscimo) + novo título.
@ApiTags("accounts-receivable")
@ApiBearerAuth()
@Controller("accounts-receivable")
export class AccountsReceivableController {
  constructor(private readonly accountsReceivableService: AccountsReceivableService) {}

  @Get()
  @RequirePermission("accounts_receivable:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsReceivableService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("accounts_receivable:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.accountsReceivableService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("accounts_receivable:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountsReceivableDto) {
    return this.accountsReceivableService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/receipts")
  @RequirePermission("accounts_receivable:receive")
  registerReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RegisterReceiptDto,
  ) {
    return this.accountsReceivableService.registerReceipt(user.organizationId, user.id, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("accounts_receivable:cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.accountsReceivableService.cancel(user.organizationId, user.id, id);
  }
}
