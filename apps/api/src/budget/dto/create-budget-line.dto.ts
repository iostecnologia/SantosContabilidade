import { IsInt, IsNumber, IsPositive, IsString, Max, Min } from "class-validator";

export class CreateBudgetLineDto {
  @IsString()
  accountId!: string;

  @IsString()
  costCenterId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}
