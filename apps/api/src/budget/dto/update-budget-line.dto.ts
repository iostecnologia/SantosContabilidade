import { IsNumber, IsPositive } from "class-validator";

export class UpdateBudgetLineDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}
