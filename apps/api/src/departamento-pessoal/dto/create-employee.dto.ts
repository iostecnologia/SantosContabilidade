import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MaxLength(20)
  cpf!: string;

  @IsDateString()
  admissionDate!: string;

  @IsString()
  @MaxLength(120)
  position!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  baseSalary!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  dependentsCount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transportVoucherMonthlyValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mealVoucherMonthlyValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  mealVoucherDiscountRate?: number;
}
