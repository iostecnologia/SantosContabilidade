import { IsDateString, IsInt, IsString, Max, Min } from "class-validator";

export class CreateVacationDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  acquisitionPeriodStart!: string;

  @IsDateString()
  acquisitionPeriodEnd!: string;

  @IsDateString()
  startDate!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  daysTaken!: number;

  // Abono pecuniário: no máximo 1/3 dos 30 dias (10 dias) por lei.
  @IsInt()
  @Min(0)
  @Max(10)
  daysSold!: number;
}
