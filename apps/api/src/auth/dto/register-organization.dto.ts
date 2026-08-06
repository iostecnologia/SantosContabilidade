import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterOrganizationDto {
  @IsString()
  @MaxLength(160)
  organizationName!: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "slug deve conter apenas letras minúsculas, números e hífen (ex.: acme-contabilidade)",
  })
  organizationSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  organizationTaxId?: string;

  @IsString()
  @MaxLength(160)
  adminFullName!: string;

  @IsEmail()
  @MaxLength(160)
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  adminPassword!: string;
}
