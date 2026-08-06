import { IsDateString, IsString } from "class-validator";

export class DisposeFixedAssetDto {
  @IsDateString()
  disposalDate!: string;

  @IsString()
  lossOnDisposalAccountId!: string;
}
