import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateMenuGroupDto {
  @IsString()
  @MaxLength(32)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;
}
