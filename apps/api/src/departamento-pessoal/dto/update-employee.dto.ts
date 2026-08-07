import { IsDateString, IsIn, IsNumber, IsOptional, IsInt, IsPositive, IsString, Max, MaxLength, Min } from "class-validator";

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

  // Campos abaixo alimentam apenas a geração de eventos eSocial — ver
  // comentário em schema.prisma no model Employee.
  @IsOptional()
  @IsString()
  @MaxLength(14)
  pis?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(["M", "F"])
  sex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ctpsNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ctpsSeries?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cboCode?: string;

  @IsOptional()
  @IsInt()
  esocialCategoryCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  addressNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressComplement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressNeighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  addressCityIbgeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  addressState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  addressZipCode?: string;
}
