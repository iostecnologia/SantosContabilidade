import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { SpedEcdService } from "./sped-ecd.service";

@ApiTags("sped-ecd")
@ApiBearerAuth()
@Controller("sped/ecd")
export class SpedEcdController {
  constructor(private readonly spedEcd: SpedEcdService) {}

  @Get()
  @RequirePermission("sped:generate")
  gerar(@CurrentUser() user: AuthenticatedUser, @Query("year") year: string) {
    return this.spedEcd.gerar(user.organizationId, Number(year));
  }
}
