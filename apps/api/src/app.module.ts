import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { AuthModule } from "./auth/auth.module";
import { RolesModule } from "./roles/roles.module";
import { UsersModule } from "./users/users.module";
import { CostCentersModule } from "./cost-centers/cost-centers.module";
import { AccountsModule } from "./accounts/accounts.module";
import { JournalEntriesModule } from "./journal-entries/journal-entries.module";
import { FiscalModule } from "./fiscal/fiscal.module";
import { CounterpartiesModule } from "./counterparties/counterparties.module";
import { BankAccountsModule } from "./bank-accounts/bank-accounts.module";
import { AccountsPayableModule } from "./accounts-payable/accounts-payable.module";
import { AccountsReceivableModule } from "./accounts-receivable/accounts-receivable.module";
import { FixedAssetsModule } from "./fixed-assets/fixed-assets.module";
import { BudgetModule } from "./budget/budget.module";
import { WarehousesModule } from "./warehouses/warehouses.module";
import { InventoryItemsModule } from "./inventory-items/inventory-items.module";
import { ReportsModule } from "./reports/reports.module";
import { BankReconciliationModule } from "./bank-reconciliation/bank-reconciliation.module";
import { DepartamentoPessoalModule } from "./departamento-pessoal/departamento-pessoal.module";
import { SpedEsocialModule } from "./sped-esocial/sped-esocial.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TenancyModule,
    AuthModule,
    RolesModule,
    UsersModule,
    CostCentersModule,
    AccountsModule,
    JournalEntriesModule,
    FiscalModule,
    CounterpartiesModule,
    BankAccountsModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    FixedAssetsModule,
    BudgetModule,
    WarehousesModule,
    InventoryItemsModule,
    ReportsModule,
    BankReconciliationModule,
    DepartamentoPessoalModule,
    SpedEsocialModule,
  ],
})
export class AppModule {}
