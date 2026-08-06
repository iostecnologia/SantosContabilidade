import { IsDateString, IsOptional, IsString } from "class-validator";

export class GeneralLedgerQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
