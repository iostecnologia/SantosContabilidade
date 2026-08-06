import { IsString, MaxLength } from "class-validator";

export class UpdateRoleDto {
  @IsString()
  @MaxLength(120)
  name!: string;
}
