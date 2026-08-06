import { IsDateString, IsNumber, IsPositive, IsString } from "class-validator";

export class RegisterOutboundDto {
  @IsString()
  warehouseId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @IsString()
  counterAccountId!: string;

  @IsDateString()
  movementDate!: string;
}
