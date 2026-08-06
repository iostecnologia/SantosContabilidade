import { IsString, MaxLength } from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(10)
  unit!: string;

  @IsString()
  inventoryAccountId!: string;
}
