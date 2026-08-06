import { IsDateString, IsNumber, IsPositive, IsString } from "class-validator";

export class RegisterInboundDto {
  @IsString()
  warehouseId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  unitCost!: number;

  @IsString()
  counterAccountId!: string;

  @IsDateString()
  movementDate!: string;
}
