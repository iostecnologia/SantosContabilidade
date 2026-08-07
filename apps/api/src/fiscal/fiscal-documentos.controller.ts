import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { FiscalDocumentosService } from "./fiscal-documentos.service";
import { ApuracaoTributariaService } from "./apuracao-tributaria.service";
import { LancarDocumentoFiscalDto } from "./dto/lancar-documento-fiscal.dto";
import { ApurarTributosDto } from "./dto/apurar-tributos.dto";

@ApiTags("fiscal-documentos")
@ApiBearerAuth()
@Controller("fiscal/documentos")
export class FiscalDocumentosController {
  constructor(
    private readonly fiscalDocumentosService: FiscalDocumentosService,
    private readonly apuracaoTributaria: ApuracaoTributariaService,
  ) {}

  @Get()
  @RequirePermission("fiscal:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.fiscalDocumentosService.list(user.organizationId);
  }

  @Get(":id")
  @RequirePermission("fiscal:read")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fiscalDocumentosService.findOneOrThrow(user.organizationId, id);
  }

  /** Cálculo prévio (sem persistir nada) — usado pelo formulário de emissão para mostrar os tributos antes de confirmar. */
  @Post("apuracao-preview")
  @RequirePermission("fiscal:read")
  apuracaoPreview(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApurarTributosDto) {
    return this.apuracaoTributaria.apurar(user.organizationId, dto.naturezaOperacao, dto.itens);
  }

  @Post()
  @RequirePermission("fiscal:create")
  emitir(@CurrentUser() user: AuthenticatedUser, @Body() dto: LancarDocumentoFiscalDto) {
    return this.fiscalDocumentosService.emitir(user.organizationId, user.id, dto.documento, dto.mapeamentoContabil ?? {});
  }

  @Get(":id/xml")
  @RequirePermission("fiscal:read")
  gerarXml(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fiscalDocumentosService.gerarXml(user.organizationId, id);
  }
}
