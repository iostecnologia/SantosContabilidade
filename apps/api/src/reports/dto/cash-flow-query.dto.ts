import { IsDateString } from "class-validator";

export class CashFlowQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
