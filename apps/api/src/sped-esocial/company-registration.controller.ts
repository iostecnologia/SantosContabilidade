import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CompanyRegistrationService } from "./company-registration.service";
import { UpdateCompanyRegistrationDto } from "./dto/update-company-registration.dto";

@ApiTags("company-registration")
@ApiBearerAuth()
@Controller("company-registration")
export class CompanyRegistrationController {
  constructor(private readonly companyRegistrationService: CompanyRegistrationService) {}

  @Get()
  @RequirePermission("company_registration:read")
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.companyRegistrationService.getOrCreate(user.organizationId);
  }

  @Patch()
  @RequirePermission("company_registration:update")
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyRegistrationDto) {
    return this.companyRegistrationService.update(user.organizationId, dto);
  }
}
