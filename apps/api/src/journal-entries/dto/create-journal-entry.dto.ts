import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { CreateJournalEntryLineDto } from "./create-journal-entry-line.dto";

export class CreateJournalEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsDateString()
  competenceDate!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceModule?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsArray()
  @ArrayMinSize(2, { message: "O lançamento precisa de ao menos duas linhas (uma de débito e uma de crédito)." })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];
}
