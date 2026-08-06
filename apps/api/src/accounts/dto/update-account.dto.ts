import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}
