import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ReportsService } from "./reports.service";
import { TrialBalanceQueryDto } from "./dto/trial-balance-query.dto";
import { GeneralLedgerQueryDto } from "./dto/general-ledger-query.dto";
import { IncomeStatementQueryDto } from "./dto/income-statement-query.dto";
import { BalanceSheetQueryDto } from "./dto/balance-sheet-query.dto";
import { CashFlowQueryDto } from "./dto/cash-flow-query.dto";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("trial-balance")
  @RequirePermission("reports:read")
  trialBalance(@CurrentUser() user: AuthenticatedUser, @Query() query: TrialBalanceQueryDto) {
    return this.reportsService.trialBalance(user.organizationId, query);
  }

  @Get("general-ledger/:accountId")
  @RequirePermission("reports:read")
  generalLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId") accountId: string,
    @Query() query: GeneralLedgerQueryDto,
  ) {
    return this.reportsService.generalLedger(user.organizationId, accountId, query);
  }

  @Get("income-statement")
  @RequirePermission("reports:read")
  incomeStatement(@CurrentUser() user: AuthenticatedUser, @Query() query: IncomeStatementQueryDto) {
    return this.reportsService.incomeStatement(user.organizationId, query);
  }

  @Get("balance-sheet")
  @RequirePermission("reports:read")
  balanceSheet(@CurrentUser() user: AuthenticatedUser, @Query() query: BalanceSheetQueryDto) {
    return this.reportsService.balanceSheet(user.organizationId, query);
  }

  @Get("cash-flow")
  @RequirePermission("reports:read")
  cashFlow(@CurrentUser() user: AuthenticatedUser, @Query() query: CashFlowQueryDto) {
    return this.reportsService.cashFlow(user.organizationId, query);
  }
}
