import { IsString, MaxLength } from "class-validator";

export class SetSubmissionProtocolDto {
  @IsString()
  @MaxLength(60)
  submissionProtocol!: string;
}
