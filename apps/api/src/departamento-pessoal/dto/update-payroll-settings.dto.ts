import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdatePayrollSettingsDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  irrfDependentDeduction?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  inssCeiling?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  fgtsRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  employerInssRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  fgtsFineRateWithoutCause?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  fgtsFineRateMutualAgreement?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  transportVoucherMaxDiscountRate?: number;

  @IsOptional()
  @IsString()
  salaryExpenseAccountId?: string;

  @IsOptional()
  @IsString()
  salaryPayableAccountId?: string;

  @IsOptional()
  @IsString()
  inssPayableAccountId?: string;

  @IsOptional()
  @IsString()
  irrfPayableAccountId?: string;

  @IsOptional()
  @IsString()
  employerChargesExpenseAccountId?: string;

  @IsOptional()
  @IsString()
  fgtsPayableAccountId?: string;

  @IsOptional()
  @IsString()
  employerInssPayableAccountId?: string;

  @IsOptional()
  @IsString()
  benefitsExpenseAccountId?: string;

  @IsOptional()
  @IsString()
  benefitsPayableAccountId?: string;

  @IsOptional()
  @IsString()
  fgtsFineExpenseAccountId?: string;

  @IsOptional()
  @IsString()
  fgtsFinePayableAccountId?: string;
}
