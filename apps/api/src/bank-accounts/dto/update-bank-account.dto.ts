import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  agency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  accountNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
