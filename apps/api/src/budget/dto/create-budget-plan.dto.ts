import { IsInt, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateBudgetPlanDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscalYear!: number;

  @IsString()
  @MaxLength(200)
  name!: string;
}
