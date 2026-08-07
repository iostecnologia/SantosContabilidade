import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { SpedEfdContribuicoesService } from "./sped-efd-contribuicoes.service";

@ApiTags("sped-efd-contribuicoes")
@ApiBearerAuth()
@Controller("sped/efd-contribuicoes")
export class SpedEfdContribuicoesController {
  constructor(private readonly spedEfdContribuicoes: SpedEfdContribuicoesService) {}

  @Get()
  @RequirePermission("sped:generate")
  gerar(@CurrentUser() user: AuthenticatedUser, @Query("year") year: string, @Query("month") month: string) {
    return this.spedEfdContribuicoes.gerar(user.organizationId, Number(year), Number(month));
  }
}
