import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, ValidateNested } from "class-validator";
import { TaxBracketType } from "@prisma/client";

export class TaxBracketInputDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  minBase!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  maxBase?: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  rate!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  deduction!: number;
}

export class SetTaxBracketsDto {
  @IsEnum(TaxBracketType)
  type!: TaxBracketType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TaxBracketInputDto)
  brackets!: TaxBracketInputDto[];
}
