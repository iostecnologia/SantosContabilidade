import { Body, Controller, Get, Patch, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { PayrollSettingsService } from "./payroll-settings.service";
import { UpdatePayrollSettingsDto } from "./dto/update-payroll-settings.dto";
import { SetTaxBracketsDto } from "./dto/set-tax-brackets.dto";

@ApiTags("payroll-settings")
@ApiBearerAuth()
@Controller("payroll-settings")
export class PayrollSettingsController {
  constructor(private readonly payrollSettingsService: PayrollSettingsService) {}

  @Get()
  @RequirePermission("payroll_settings:read")
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollSettingsService.getOrCreate(user.organizationId);
  }

  @Patch()
  @RequirePermission("payroll_settings:update")
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePayrollSettingsDto) {
    return this.payrollSettingsService.update(user.organizationId, dto);
  }

  @Put("tax-brackets")
  @RequirePermission("payroll_settings:update")
  setTaxBrackets(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetTaxBracketsDto) {
    return this.payrollSettingsService.setTaxBrackets(user.organizationId, dto);
  }
}
