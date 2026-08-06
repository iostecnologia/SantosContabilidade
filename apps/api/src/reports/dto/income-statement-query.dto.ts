import { IsDateString, IsOptional, IsString } from "class-validator";

export class IncomeStatementQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
