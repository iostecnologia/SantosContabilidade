import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, ValidateNested } from "class-validator";
import { AnexoSimplesNacional } from "@prisma/client";

export class SimplesBracketInputDto {
  @IsNumber({ maxDecimalPlaces: 2 }) rbt12Min!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rbt12Max?: number;
  @IsNumber({ maxDecimalPlaces: 4 }) aliquotaNominal!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) parcelaDeduzir!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualIrpj!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualCsll!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualCofins!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualPis!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualCpp!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) percentualIcmsOuIss!: number;
}

export class SetSimplesBracketsDto {
  @IsEnum(AnexoSimplesNacional)
  anexo!: AnexoSimplesNacional;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SimplesBracketInputDto)
  brackets!: SimplesBracketInputDto[];
}
