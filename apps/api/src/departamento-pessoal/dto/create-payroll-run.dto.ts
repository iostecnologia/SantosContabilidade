import { IsInt, Max, Min } from "class-validator";

export class CreatePayrollRunDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  competenceYear!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  competenceMonth!: number;
}
