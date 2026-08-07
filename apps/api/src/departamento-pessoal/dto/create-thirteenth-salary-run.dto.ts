import { IsEnum, IsInt, Max, Min } from "class-validator";
import { ThirteenthSalaryInstallment } from "@prisma/client";

export class CreateThirteenthSalaryRunDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsEnum(ThirteenthSalaryInstallment)
  installment!: ThirteenthSalaryInstallment;
}
