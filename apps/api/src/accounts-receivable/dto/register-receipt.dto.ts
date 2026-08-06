import { IsDateString, IsNumber, IsPositive, IsString } from "class-validator";

export class RegisterReceiptDto {
  @IsDateString()
  receiptDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  bankAccountId!: string;
}
