import { IsDateString } from "class-validator";

export class RunDepreciationDto {
  @IsDateString()
  competenceMonth!: string;
}
