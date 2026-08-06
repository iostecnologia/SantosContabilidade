import { IsString, MaxLength } from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;
}
