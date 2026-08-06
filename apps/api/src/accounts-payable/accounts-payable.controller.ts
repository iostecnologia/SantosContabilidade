import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccountsPayableService } from "./accounts-payable.service";
import { CreateAccountsPayableDto } from "./dto/create-accounts-payable.dto";
import { RegisterPaymentDto } from "./dto/register-payment.dto";

// Sem PUT/PATCH de edição genérica de propósito: correção de um título é
// sempre por cancelamento (estorna o acréscimo) + novo título, nunca edição
// de valores/contas já postados.
@ApiTags("accounts-payable")
@ApiBearerAuth()
@Controller("accounts-payable")
export class AccountsPayableController {
  constructor(private readonly accountsPayableService: AccountsPayableService) {}

  @Get()
  @RequirePermission("accounts_payable:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsPayableService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("accounts_payable:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.accountsPayableService.findOneOrThrow(user.organizationId, id);
  }

  @Post()
  @RequirePermission("accounts_payable:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountsPayableDto) {
    return this.accountsPayableService.create(user.organizationId, user.id, dto);
  }

  @Post(":id/payments")
  @RequirePermission("accounts_payable:pay")
  registerPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.accountsPayableService.registerPayment(user.organizationId, user.id, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("accounts_payable:cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.accountsPayableService.cancel(user.organizationId, user.id, id);
  }
}
