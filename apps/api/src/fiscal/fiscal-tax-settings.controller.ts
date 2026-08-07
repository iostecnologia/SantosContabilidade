import { Body, Controller, Get, Patch, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { FiscalTaxSettingsService } from "./fiscal-tax-settings.service";
import { UpdateFiscalTaxSettingsDto } from "./dto/update-fiscal-tax-settings.dto";
import { SetSimplesBracketsDto } from "./dto/set-simples-brackets.dto";
import { SetIcmsUfRatesDto } from "./dto/set-icms-uf-rates.dto";

@ApiTags("fiscal-tax-settings")
@ApiBearerAuth()
@Controller("fiscal/tax-settings")
export class FiscalTaxSettingsController {
  constructor(private readonly fiscalTaxSettingsService: FiscalTaxSettingsService) {}

  @Get()
  @RequirePermission("fiscal:read")
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.fiscalTaxSettingsService.getOrCreate(user.organizationId);
  }

  @Patch()
  @RequirePermission("fiscal:update_settings")
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFiscalTaxSettingsDto) {
    return this.fiscalTaxSettingsService.update(user.organizationId, dto);
  }

  @Put("simples-brackets")
  @RequirePermission("fiscal:update_settings")
  setSimplesBrackets(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetSimplesBracketsDto) {
    return this.fiscalTaxSettingsService.setSimplesBrackets(user.organizationId, dto);
  }

  @Put("icms-uf-rates")
  @RequirePermission("fiscal:update_settings")
  setIcmsUfRates(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetIcmsUfRatesDto) {
    return this.fiscalTaxSettingsService.setIcmsUfRates(user.organizationId, dto);
  }
}
