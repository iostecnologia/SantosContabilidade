import { IsEmail, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MaxLength(64)
  organizationSlug!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
