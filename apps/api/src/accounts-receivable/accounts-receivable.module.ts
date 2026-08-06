import { Module } from "@nestjs/common";
import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { AccountsReceivableController } from "./accounts-receivable.controller";
import { AccountsReceivableService } from "./accounts-receivable.service";

@Module({
  imports: [JournalEntriesModule, CounterpartiesModule, BankAccountsModule],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
  exports: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
