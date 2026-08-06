import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { NaturezaOperacaoFiscal, TipoDocumentoFiscal } from "../domain/documento-fiscal";

export class ItemDocumentoFiscalDto {
  @IsString()
  @MaxLength(300)
  descricao!: string;

  @IsNumber()
  @IsPositive()
  quantidade!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  valorUnitario!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorTotal!: number;

  @IsOptional()
  @IsString()
  centroCustoId?: string;
}

export class RetencoesDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) irrf?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) csll?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) pis?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cofins?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) iss?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) inss?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cbsRetido?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) ibsRetido?: number;
}

export class DocumentoFiscalDto {
  @IsString()
  id!: string;

  @IsEnum(TipoDocumentoFiscal)
  tipo!: TipoDocumentoFiscal;

  @IsEnum(NaturezaOperacaoFiscal)
  naturezaOperacao!: NaturezaOperacaoFiscal;

  @IsString()
  @MaxLength(60)
  numeroDocumento!: string;

  @IsDateString()
  dataEmissao!: string;

  @IsDateString()
  dataCompetencia!: string;

  @IsString()
  fornecedorOuClienteId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorTotal!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorTributosRecuperaveis?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDocumentoFiscalDto)
  itens!: ItemDocumentoFiscalDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RetencoesDto)
  retencoes?: RetencoesDto;

  @IsOptional()
  @IsString()
  centroCustoPadraoId?: string;
}
