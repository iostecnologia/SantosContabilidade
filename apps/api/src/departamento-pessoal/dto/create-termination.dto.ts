import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TerminationType } from "@prisma/client";

export class CreateTerminationDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  terminationDate!: string;

  @IsEnum(TerminationType)
  type!: TerminationType;

  // Férias vencidas (período aquisitivo já completo e não gozado) — este
  // sistema não reconstrói automaticamente múltiplos períodos aquisitivos
  // em aberto; se houver, informe o valor aqui.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vestedVacationAmount?: number;
}
