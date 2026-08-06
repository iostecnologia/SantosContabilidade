import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { FiscalLancamentoService } from "./fiscal-lancamento.service";
import { LancarDocumentoFiscalDto } from "./dto/lancar-documento-fiscal.dto";

@ApiTags("fiscal")
@ApiBearerAuth()
@Controller("fiscal")
export class FiscalController {
  constructor(private readonly fiscalLancamentoService: FiscalLancamentoService) {}

  /** Gera o rascunho do lançamento (débito/crédito por conta e centro de custo) sem persistir nada. */
  @Post("lancamentos/preview")
  @RequirePermission("fiscal:create")
  preview(@Body() dto: LancarDocumentoFiscalDto) {
    return this.fiscalLancamentoService.gerarRascunho(dto.documento, dto.mapeamentoContabil);
  }

  /** Gera o rascunho, valida o balanceamento e persiste como lançamento contábil (reference_module = FISCAL). */
  @Post("lancamentos")
  @RequirePermission("fiscal:create")
  lancar(@CurrentUser() user: AuthenticatedUser, @Body() dto: LancarDocumentoFiscalDto) {
    return this.fiscalLancamentoService.lancar(user.organizationId, user.id, dto.documento, dto.mapeamentoContabil);
  }
}
