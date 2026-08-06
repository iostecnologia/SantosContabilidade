import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCostCenterDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
