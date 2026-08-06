import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateAccountsPayableDto {
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
  expenseAccountId!: string;

  @IsString()
  liabilityAccountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
