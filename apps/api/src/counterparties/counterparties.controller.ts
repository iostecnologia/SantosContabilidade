import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CounterpartiesService } from "./counterparties.service";
import { CreateCounterpartyDto } from "./dto/create-counterparty.dto";
import { UpdateCounterpartyDto } from "./dto/update-counterparty.dto";

// Sem rota DELETE de propósito: DELETE é revogado de app_user na tabela
// `counterparties` (ver migration de RLS do módulo financeiro). Contrapartes
// não usadas mais são desativadas via PATCH { isActive: false }.
@ApiTags("counterparties")
@ApiBearerAuth()
@Controller("counterparties")
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  @RequirePermission("counterparties:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.counterpartiesService.list(user.organizationId);
  }

  @Post()
  @RequirePermission("counterparties:create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCounterpartyDto) {
    return this.counterpartiesService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermission("counterparties:update")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCounterpartyDto) {
    return this.counterpartiesService.update(user.organizationId, id, dto);
  }
}
