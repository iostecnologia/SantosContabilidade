import { IsDateString, IsNumber, IsPositive, IsString } from "class-validator";

export class RegisterTransferDto {
  @IsString()
  fromWarehouseId!: string;

  @IsString()
  toWarehouseId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @IsDateString()
  transferDate!: string;
}
