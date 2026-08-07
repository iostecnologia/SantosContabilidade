import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateCompanyRegistrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  legalNatureCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cnaeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  municipalRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  esocialTaxClassCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fpasCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  ratCode?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  fapRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  thirdPartiesCode?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountantCpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountantCrc?: string;
}
