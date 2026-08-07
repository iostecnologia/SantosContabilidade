import { IsNumber, IsOptional, IsInt, IsPositive, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  baseSalary?: number;

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
