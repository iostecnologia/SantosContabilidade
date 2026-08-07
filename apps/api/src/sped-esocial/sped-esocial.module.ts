import { Module } from "@nestjs/common";
import { CompanyRegistrationController } from "./company-registration.controller";
import { CompanyRegistrationService } from "./company-registration.service";
import { EsocialEventosController } from "./esocial/esocial-eventos.controller";
import { EsocialEventosService } from "./esocial/esocial-eventos.service";
import { SpedEcdController } from "./sped/sped-ecd.controller";
import { SpedEcdService } from "./sped/sped-ecd.service";
import { SpedEfdContribuicoesController } from "./sped/sped-efd-contribuicoes.controller";
import { SpedEfdContribuicoesService } from "./sped/sped-efd-contribuicoes.service";
import { SpedEfdIcmsIpiController } from "./sped/sped-efd-icms-ipi.controller";
import { SpedEfdIcmsIpiService } from "./sped/sped-efd-icms-ipi.service";
import { SpedEcfController } from "./sped/sped-ecf.controller";
import { SpedEcfService } from "./sped/sped-ecf.service";

@Module({
  controllers: [
    CompanyRegistrationController,
    EsocialEventosController,
    SpedEcdController,
    SpedEfdContribuicoesController,
    SpedEfdIcmsIpiController,
    SpedEcfController,
  ],
  providers: [
    CompanyRegistrationService,
    EsocialEventosService,
    SpedEcdService,
    SpedEfdContribuicoesService,
    SpedEfdIcmsIpiService,
    SpedEcfService,
  ],
})
export class SpedEsocialModule {}
