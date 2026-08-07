import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class IcmsUfRateInputDto {
  @IsString()
  @MaxLength(2)
  uf!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  internalRate!: number;
}

export class SetIcmsUfRatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IcmsUfRateInputDto)
  rates!: IcmsUfRateInputDto[];
}
