import { Module } from "@nestjs/common";
import { JournalEntriesModule } from "../journal-entries/journal-entries.module";
import { FiscalController } from "./fiscal.controller";
import { FiscalTaxSettingsController } from "./fiscal-tax-settings.controller";
import { FiscalDocumentosController } from "./fiscal-documentos.controller";
import { FiscalLancamentoService } from "./fiscal-lancamento.service";
import { FiscalTaxSettingsService } from "./fiscal-tax-settings.service";
import { ApuracaoTributariaService } from "./apuracao-tributaria.service";
import { FiscalDocumentosService } from "./fiscal-documentos.service";
import { ContextoContabilFiscal } from "./contexto-contabil-fiscal.service";
import { ContabilizacaoNfseServicoStrategy } from "./strategies/contabilizacao-nfse-servico.strategy";
import { ContabilizacaoCbsIbsStrategy } from "./strategies/contabilizacao-cbs-ibs.strategy";
import { ContabilizacaoVendaMercadoriaStrategy } from "./strategies/contabilizacao-venda-mercadoria.strategy";
import { ContabilizacaoServicoPrestadoStrategy } from "./strategies/contabilizacao-servico-prestado.strategy";

@Module({
  imports: [JournalEntriesModule],
  controllers: [FiscalController, FiscalTaxSettingsController, FiscalDocumentosController],
  providers: [
    FiscalLancamentoService,
    FiscalTaxSettingsService,
    ApuracaoTributariaService,
    FiscalDocumentosService,
    ContextoContabilFiscal,
    ContabilizacaoNfseServicoStrategy,
    ContabilizacaoCbsIbsStrategy,
    ContabilizacaoVendaMercadoriaStrategy,
    ContabilizacaoServicoPrestadoStrategy,
  ],
})
export class FiscalModule {}
