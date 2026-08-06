import { CounterpartyType } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCounterpartyDto {
  @IsEnum(CounterpartyType)
  type!: CounterpartyType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
