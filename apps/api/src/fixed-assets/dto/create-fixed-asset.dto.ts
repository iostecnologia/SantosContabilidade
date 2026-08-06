import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, MaxLength } from "class-validator";

export class CreateFixedAssetDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsDateString()
  acquisitionDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  acquisitionCost!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  residualValue?: number;

  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @IsString()
  assetAccountId!: string;

  @IsString()
  accumulatedDepreciationAccountId!: string;

  @IsString()
  depreciationExpenseAccountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
