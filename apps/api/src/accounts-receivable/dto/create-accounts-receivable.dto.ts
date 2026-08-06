import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateAccountsReceivableDto {
  @IsString()
  counterpartyId!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsDateString()
  competenceDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  originalAmount!: number;

  @IsString()
  assetAccountId!: string;

  @IsString()
  revenueAccountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
