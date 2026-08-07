import { Module } from "@nestjs/common";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { PayrollSettingsController } from "./payroll-settings.controller";
import { PayrollSettingsService } from "./payroll-settings.service";
import { PayrollRunController } from "./payroll-run.controller";
import { PayrollRunService } from "./payroll-run.service";
import { VacationController } from "./vacation.controller";
import { VacationService } from "./vacation.service";
import { ThirteenthSalaryRunController } from "./thirteenth-salary-run.controller";
import { ThirteenthSalaryRunService } from "./thirteenth-salary-run.service";
import { TerminationController } from "./termination.controller";
import { TerminationService } from "./termination.service";

@Module({
  imports: [JournalEntriesModule],
  controllers: [
    EmployeesController,
    PayrollSettingsController,
    PayrollRunController,
    VacationController,
    ThirteenthSalaryRunController,
    TerminationController,
  ],
  providers: [
    EmployeesService,
    PayrollSettingsService,
    PayrollRunService,
    VacationService,
    ThirteenthSalaryRunService,
    TerminationService,
  ],
})
export class DepartamentoPessoalModule {}
