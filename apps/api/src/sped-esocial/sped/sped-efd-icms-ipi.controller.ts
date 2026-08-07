import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { SpedEfdIcmsIpiService } from "./sped-efd-icms-ipi.service";

@ApiTags("sped-efd-icms-ipi")
@ApiBearerAuth()
@Controller("sped/efd-icms-ipi")
export class SpedEfdIcmsIpiController {
  constructor(private readonly spedEfdIcmsIpi: SpedEfdIcmsIpiService) {}

  @Get()
  @RequirePermission("sped:generate")
  gerar(@CurrentUser() user: AuthenticatedUser, @Query("year") year: string, @Query("month") month: string) {
    return this.spedEfdIcmsIpi.gerar(user.organizationId, Number(year), Number(month));
  }
}
