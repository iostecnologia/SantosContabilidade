import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from "class-validator";
import { NaturezaOperacaoFiscal } from "../domain/documento-fiscal";

export class ItemParaApuracaoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorTotal!: number;

  @IsOptional() @IsString() @MaxLength(10) ncm?: string;
  @IsOptional() @IsString() @MaxLength(2) ufOrigem?: string;
  @IsOptional() @IsString() @MaxLength(2) ufDestino?: string;
  @IsOptional() @IsString() @MaxLength(20) codigoServicoMunicipal?: string;
}

export class ApurarTributosDto {
  @IsEnum(NaturezaOperacaoFiscal)
  naturezaOperacao!: NaturezaOperacaoFiscal;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemParaApuracaoDto)
  itens!: ItemParaApuracaoDto[];
}
