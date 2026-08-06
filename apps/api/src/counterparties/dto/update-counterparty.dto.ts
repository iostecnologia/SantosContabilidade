import { CounterpartyType } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCounterpartyDto {
  @IsOptional()
  @IsEnum(CounterpartyType)
  type?: CounterpartyType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
