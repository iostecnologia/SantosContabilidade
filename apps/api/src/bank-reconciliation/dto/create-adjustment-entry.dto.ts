import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAdjustmentEntryDto {
  @IsString()
  contraAccountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
