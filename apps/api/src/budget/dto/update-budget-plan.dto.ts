import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateBudgetPlanDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscalYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
