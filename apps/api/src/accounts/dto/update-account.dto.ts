import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  // Código do plano de contas referencial da RFB, usado por ECD (registro
  // I051) e ECF (Bloco J-K) — ver comentário em schema.prisma no model Account.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  spedReferenceCode?: string;
}
