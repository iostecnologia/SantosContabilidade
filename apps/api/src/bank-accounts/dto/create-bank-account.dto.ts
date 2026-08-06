import { BankAccountKind } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBankAccountDto {
  @IsEnum(BankAccountKind)
  kind!: BankAccountKind;

  @IsString()
  @MaxLength(160)
  name!: string;

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

  @IsString()
  glAccountId!: string;
}
