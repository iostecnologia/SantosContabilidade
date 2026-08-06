import { Module } from "@nestjs/common";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { FiscalController } from "./fiscal.controller";
import { FiscalLancamentoService } from "./fiscal-lancamento.service";
import { ContextoContabilFiscal } from "./contexto-contabil-fiscal.service";
import { ContabilizacaoNfseServicoStrategy } from "./strategies/contabilizacao-nfse-servico.strategy";
import { ContabilizacaoCbsIbsStrategy } from "./strategies/contabilizacao-cbs-ibs.strategy";

@Module({
  imports: [JournalEntriesModule],
  controllers: [FiscalController],
  providers: [
    FiscalLancamentoService,
    ContextoContabilFiscal,
    ContabilizacaoNfseServicoStrategy,
    ContabilizacaoCbsIbsStrategy,
  ],
})
export class FiscalModule {}
