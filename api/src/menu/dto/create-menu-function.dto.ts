import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMenuFunctionDto {
  @IsString()
  @MaxLength(32)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  // legacy compatibility: keep a "type" field
  @IsString()
  @MaxLength(8)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  // Enhancement: hide/show based on your RBAC permission keys
  // If you want strict legacy mapping, just set this = code.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredPermissionKey?: string;
}
