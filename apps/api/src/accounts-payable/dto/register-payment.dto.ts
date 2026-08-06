import { IsDateString, IsNumber, IsPositive, IsString } from "class-validator";

export class RegisterPaymentDto {
  @IsDateString()
  paymentDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  bankAccountId!: string;
}
