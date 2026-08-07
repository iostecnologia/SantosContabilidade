import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { AnexoSimplesNacional, PisCofinsRegime, RegimeTributario } from "@prisma/client";

export class UpdateFiscalTaxSettingsDto {
  @IsOptional()
  @IsEnum(RegimeTributario)
  regimeTributario?: RegimeTributario;

  @IsOptional()
  @IsEnum(AnexoSimplesNacional)
  anexoSimplesNacional?: AnexoSimplesNacional;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receitaBruta12Meses?: number;

  @IsOptional()
  @IsEnum(PisCofinsRegime)
  pisCofinsRegime?: PisCofinsRegime;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  pisRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  cofinsRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  issRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  icmsDefaultInternalRate?: number;

  @IsOptional() @IsString() receitaVendasAccountId?: string;
  @IsOptional() @IsString() receitaServicosAccountId?: string;
  @IsOptional() @IsString() deducoesTributariasVendasAccountId?: string;
  @IsOptional() @IsString() deducoesTributariasServicosAccountId?: string;
  @IsOptional() @IsString() clientesAReceberAccountId?: string;
  @IsOptional() @IsString() icmsPayableAccountId?: string;
  @IsOptional() @IsString() pisPayableAccountId?: string;
  @IsOptional() @IsString() cofinsPayableAccountId?: string;
  @IsOptional() @IsString() issPayableAccountId?: string;
  @IsOptional() @IsString() simplesNacionalPayableAccountId?: string;
}
