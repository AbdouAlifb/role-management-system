import { IsOptional, IsString } from "class-validator";

export class CreatePermissionDto {
  @IsString() key: string; // e.g. "users.read", "claims.approve"
  @IsOptional() @IsString() description?: string;
}
