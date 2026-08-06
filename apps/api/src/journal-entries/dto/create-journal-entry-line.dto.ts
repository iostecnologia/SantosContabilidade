import { LineDirection } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateJournalEntryLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsEnum(LineDirection)
  direction!: LineDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}
