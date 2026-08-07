import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { SpedEcfService } from "./sped-ecf.service";

@ApiTags("sped-ecf")
@ApiBearerAuth()
@Controller("sped/ecf")
export class SpedEcfController {
  constructor(private readonly spedEcf: SpedEcfService) {}

  @Get()
  @RequirePermission("sped:generate")
  gerar(@CurrentUser() user: AuthenticatedUser, @Query("year") year: string) {
    return this.spedEcf.gerar(user.organizationId, Number(year));
  }
}
