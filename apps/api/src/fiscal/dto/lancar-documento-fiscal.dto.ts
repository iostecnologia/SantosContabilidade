import { Type } from "class-transformer";
import { IsObject, IsOptional, ValidateNested } from "class-validator";
import { DocumentoFiscalDto } from "./documento-fiscal.dto";

export class LancarDocumentoFiscalDto {
  @ValidateNested()
  @Type(() => DocumentoFiscalDto)
  documento!: DocumentoFiscalDto;

  /**
   * Mapa CategoriaContaFiscal -> id da conta analítica do tenant (ver
   * enum CategoriaContaFiscal). Opcional em POST /fiscal/documentos (venda/
   * serviço prestado): as categorias que Configurações Fiscais já cobre são
   * preenchidas automaticamente por FiscalDocumentosService — só precisa
   * informar aqui categorias fora desse mapeamento (ex.: compra/serviço
   * tomado/CBS-IBS, que não têm conta configurável em Configurações Fiscais).
   */
  @IsOptional()
  @IsObject()
  mapeamentoContabil?: Record<string, string>;
}
