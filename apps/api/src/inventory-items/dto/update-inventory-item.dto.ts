import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
