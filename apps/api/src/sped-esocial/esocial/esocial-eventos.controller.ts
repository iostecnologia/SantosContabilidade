import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { EsocialEventosService } from "./esocial-eventos.service";
import { SetSubmissionProtocolDto } from "./dto/set-submission-protocol.dto";

@ApiTags("esocial-eventos")
@ApiBearerAuth()
@Controller("esocial/eventos")
export class EsocialEventosController {
  constructor(private readonly esocialEventos: EsocialEventosService) {}

  @Get()
  @RequirePermission("esocial:read")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.esocialEventos.list(user.organizationId);
  }

  @Post("info-empregador")
  @RequirePermission("esocial:create")
  gerarS1000(@CurrentUser() user: AuthenticatedUser) {
    return this.esocialEventos.gerarS1000(user.organizationId, user.id);
  }

  @Post("estabelecimentos")
  @RequirePermission("esocial:create")
  gerarS1005(@CurrentUser() user: AuthenticatedUser) {
    return this.esocialEventos.gerarS1005(user.organizationId, user.id);
  }

  @Post("admissao/:employeeId")
  @RequirePermission("esocial:create")
  gerarS2200(@CurrentUser() user: AuthenticatedUser, @Param("employeeId") employeeId: string) {
    return this.esocialEventos.gerarS2200(user.organizationId, user.id, employeeId);
  }

  @Post("ferias/:vacationId")
  @RequirePermission("esocial:create")
  gerarS2230Ferias(@CurrentUser() user: AuthenticatedUser, @Param("vacationId") vacationId: string) {
    return this.esocialEventos.gerarS2230Ferias(user.organizationId, user.id, vacationId);
  }

  @Post("desligamento/:terminationId")
  @RequirePermission("esocial:create")
  gerarS2299(@CurrentUser() user: AuthenticatedUser, @Param("terminationId") terminationId: string) {
    return this.esocialEventos.gerarS2299(user.organizationId, user.id, terminationId);
  }

  @Post("remuneracao/:payrollRunId")
  @RequirePermission("esocial:create")
  gerarS1200(@CurrentUser() user: AuthenticatedUser, @Param("payrollRunId") payrollRunId: string) {
    return this.esocialEventos.gerarS1200(user.organizationId, user.id, payrollRunId);
  }

  @Patch(":id/protocolo")
  @RequirePermission("esocial:update")
  setSubmissionProtocol(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetSubmissionProtocolDto) {
    return this.esocialEventos.setSubmissionProtocol(user.organizationId, id, dto);
  }
}
