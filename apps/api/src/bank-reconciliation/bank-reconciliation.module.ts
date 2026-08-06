import { Module } from "@nestjs/common";
import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { BankReconciliationController } from "./bank-reconciliation.controller";
import { BankReconciliationService } from "./bank-reconciliation.service";

@Module({
  imports: [BankAccountsModule, JournalEntriesModule],
  controllers: [BankReconciliationController],
  providers: [BankReconciliationService],
})
export class BankReconciliationModule {}
