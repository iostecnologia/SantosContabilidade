import { Type } from "class-transformer";
import { IsObject, ValidateNested } from "class-validator";
import { DocumentoFiscalDto } from "./documento-fiscal.dto";

export class LancarDocumentoFiscalDto {
  @ValidateNested()
  @Type(() => DocumentoFiscalDto)
  documento!: DocumentoFiscalDto;

  /**
   * Mapa CategoriaContaFiscal -> id da conta analítica do tenant (ver
   * enum CategoriaContaFiscal). Só precisa conter as categorias que a
   * estratégia escolhida para `documento.tipo` de fato usa.
   */
  @IsObject()
  mapeamentoContabil!: Record<string, string>;
}
