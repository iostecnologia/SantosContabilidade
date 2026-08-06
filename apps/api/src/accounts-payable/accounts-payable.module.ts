import { Module } from "@nestjs/common";
import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { AccountsPayableController } from "./accounts-payable.controller";
import { AccountsPayableService } from "./accounts-payable.service";

@Module({
  imports: [JournalEntriesModule, CounterpartiesModule, BankAccountsModule],
  controllers: [AccountsPayableController],
  providers: [AccountsPayableService],
  exports: [AccountsPayableService],
})
export class AccountsPayableModule {}
