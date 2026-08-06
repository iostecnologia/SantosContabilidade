import { IsDateString, IsOptional, IsString } from "class-validator";

export class BalanceSheetQueryDto {
  @IsDateString()
  asOfDate!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
