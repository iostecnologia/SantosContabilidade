import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCostCenterDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
